/*
 * It is a singleton, the only instance is located in `exports`
 * @todo instantiate for each test suite explicitly
 */

import debug from 'debug'
import FileStorage from './storage'
import signale from './logger'
import createRequestHandler from './handleRequest'
import createResponseHandler from './handleResponse'
import { Options, UserOptions, Driver, Storage, UserInterceptor, Interceptor, SpyTuple, Spy } from './types'
import { isInterceptorMatched, userOptionsToOptions, userInterceptorToInterceptor } from './utils'
import PuppeteerDriver from './p-driver'
import { DEFAULT_OPTIONS } from './consts'

const logger = debug('teremock')

function noop() {}

class Teremock {
  private defaultOptions: Options
  private extraParams: UserOptions
  private options: Options
  private storage: Storage
  /** set of urls of currently active connections. all connections became inactive after response. */
  private reqSet: Set<string>
  /** set of urls of currently active connections, which cleared only on connections resolve */
  private reqSetRet: Set<string>
  private alive: boolean
  private reqsPromise: Promise<any>
  private removeCloseHandler: Function | null
  private removeRequestHandler: Function | null
  private removeResponseHandler: Function | null
  protected driver: Driver | undefined
  private _startPromise: Promise<any> | void
  private _resolveReqs: Function
  private _rejectReqs: Function
  private _spies: SpyTuple[]
  private _interceptors: Record<string, Interceptor>
  private _matched: Map<string, string[]>

  constructor(opts?: { storage?: Storage, driver?: Driver }) {
    signale.debug(`new Mocker`)
    this.defaultOptions = Object.assign({}, DEFAULT_OPTIONS)

    this._spies = []
    this._interceptors = {}
    this._resolveReqs = noop
    this._rejectReqs = noop
    this._matched = new Map()
    this.storage = opts?.storage ?? new FileStorage()
    this.driver = opts?.driver
  }

  private _onAnyReqStart(req) {
    if (this.reqSet.size === 0) {
      this.reqsPromise = new Promise((resolve, reject) => {
        this._resolveReqs = () => {
          resolve(Array.from(this.reqSetRet))
          this.reqSetRet.clear()
        }
        this._rejectReqs = (...args) => {
          console.trace()
          signale.log('args', args)
          reject(...args)
        }
      })
    }

    if (this._spies.length > 0) {
      this._spies.forEach(([interceptor, spy]) => {
        if (isInterceptorMatched(interceptor, req)) {
          spy.called = true
          spy.callCount++
          spy.calledOnce = spy.callCount === 1
          const { requestId, requestTimestamp, requestOrder } = req
          if (requestId !== -1) {
            spy.events.push({
              requestTimestamp,
              requestOrder,
              requestId
            })
          }
        }
      })
    }
  }
  private _onAnyReqEnd(req) {
    if (this._spies.length > 0) {
      this._spies.forEach(([interceptor, spy]) => {
        if (isInterceptorMatched(interceptor, req)) {
          const { requestId, responseTimestamp, responseOrder } = req
          if (requestId !== -1) {
            const requestObj = spy.events.find(obj => obj.requestId === requestId)
            if (requestObj) {
              requestObj.responseTimestamp = responseTimestamp
              requestObj.responseOrder = responseOrder
            }
          }
        }
      })
    }
  }

  /*
   * Starts to intercept requests
   */
  public async start(userOptions: UserOptions) {
    signale.debug(`mocker.start()`)
    if (this.alive) {
      signale.warn(`mocker was not stopped before new start call, stopping it first`)
      await this.stop()
    }

    let resolveStartPromise
    this._startPromise = new Promise((resolve) => {
      resolveStartPromise = resolve
    })
    this.alive = true
    this.options = userOptionsToOptions(this.defaultOptions, userOptions)
    this.options.wd && this.storage.setWd?.(this.options.wd)
    this.driver = this.driver ?? new PuppeteerDriver({ page: userOptions.page })
    await this.driver.setRequestInterception(true)
    this._spies = []
    this._interceptors = this.options.interceptors
    this._matched = new Map()

    const logParams = Object.assign({}, this.options)
    logger('Mocker starts with resulting params:', logParams)

    this.reqSet = new Set()
    this.reqSetRet = new Set()
    // Clear on any page close, or sometimes you loose some responses on unload, and `connections` will never resolves
    this.removeCloseHandler = this.driver.onClose?.(() => {

      logger('removeCloseHandler', this.reqSet.size)
      if (this.reqSet.size !== 0) {
        if (!this.options.ci) {
          signale.error(`Some connections was not completed, but navigation happened.`)
          signale.error(`That is bad, mkay? Because you have a race: server response and navigation`)
          signale.error(`That will lead to heisenberg MONOFO errors in case when response will win the race`)
          signale.error(`Alive connections:\n${[...this.reqSet]}`)
        }
        this.reqSet.clear()
        this._resolveReqs()
      }
      this.stop({ safe: true })
    })

    const pureRequestHandler = createRequestHandler({
      ...this.options,
      interceptors: this._interceptors,
      storage: this.storage,
      reqSet: {
        add: (en) => {
          this.reqSet.add(en)
          this.reqSetRet.add(en)
        },
        get: () => this.reqSet,
      },
      _onReqStarted: (req) => this._onAnyReqStart(req),
      _onReqsReject: (...args) => this._rejectReqs(...args),
      _onMatch: (interceptor: Interceptor, req: any) => {
        if (!this._matched.has(interceptor.name)) {
          this._matched.set(interceptor.name, [])
        }

        this._matched.get(interceptor.name)?.push(req.url)
      }
    })

    const pureResponseHandler = createResponseHandler({
      ...this.options,
      interceptors: this._interceptors,
      storage: this.storage,
      reqSet: this.reqSet,
      _onReqCompleted: (req) => this._onAnyReqEnd(req),
      _onReqsCompleted: () => this._resolveReqs(),
      _onReqsReject: (...args) => this._rejectReqs(...args),
    })

    logger('Handlers created, params validated')

    // Intercepting all requests and respinding with mocks
    this.removeRequestHandler = await this.driver.onRequest((ir) => pureRequestHandler(ir, {
      ...this.extraParams,
      interceptors: this._interceptors,
    }))

    // Writing mocks on real responses to filesystem
    this.removeResponseHandler = await this.driver.onResponse((ir) => pureResponseHandler(ir, {
      ...this.extraParams,
      interceptors: this._interceptors,
    }))

    logger('_startPromise about to resolve (Request interception enabled, listeners added)')

    resolveStartPromise()

    return this._startPromise
  }

  public add(userInterceptor: UserInterceptor, overwrite = false): () => void {
    const interceptor = userInterceptorToInterceptor(userInterceptor)
    const { name } = interceptor

    if (name in this._interceptors && !overwrite) {
      signale.error(`interceptor with name "${name}" already exists, pass second arg true if you want to overwrite it`)
      return () => {}
    }

    this._interceptors = {
      [name]: interceptor,
      ...this._interceptors,
    }

    // @todo support restoring overwritten names
    return () => {
      const { [name]: omit, ...rest } = this._interceptors
      this._interceptors = rest
    }
  }

  public remove(userInterceptor: UserInterceptor) {
    const interceptor = userInterceptorToInterceptor(userInterceptor)
    const { name } = interceptor

    if (!this._interceptors[name]) {
      signale.error(`there is no interceptor with name "${name}"`)
    }

    const { [name]: _x, ...rest } = this._interceptors

    this._interceptors = rest
  }

  /*
   * Resolves when all mocked connections are completed
   * @deprecated
   */
  public connections(opts = { timeout: 1000 }) {
    signale.warn(`teremock.connections() is deprecated`)
    signale.warn(`it is recommended to await explicit effects as a result of requests`)

    const { timeout } = opts

    if (typeof this._startPromise === 'undefined') {
      throw new Error('Cant await connections. Probably you didnt start the mocker?')
    }

    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(`failed to await connectins in ${timeout} ms`)), timeout)
    })

    if (typeof this.reqsPromise === 'undefined') {
      throw new Error(`no connections, nothing to await`)
    }

    return Promise.race([timeoutPromise, this.reqsPromise])
  }

  public spy(spyInterceptor: UserInterceptor) {
    const interceptor = userInterceptorToInterceptor(spyInterceptor, 'spy')
    const spy: Spy = {
      callCount: 0,
      calledOnce: false,
      called: false,
      dismiss: () => {
        this._spies = this._spies.filter(([_i, s]) => s !== spy)
      },
      events: [],
    }

    this._spies.push([interceptor, spy])

    return spy
  }

  /*
   * Waits for all connections to be completed and removes all handlers from the page
   */
  public async stop(opts: { safe?: boolean } = {}) {
    const { safe } = opts
    if (!this.alive) {
      if (safe) {
        return
      }

      // Async, because jest suppress Errors in `after` callbacks
      setTimeout(() => {
        signale.warn(`nothing to stop. Did you call 'mocker.stop()' twice?`)
      })

      return
    }

    const t1 = setTimeout(() => {
      if (this.reqSet.size === 0) {
        logger(`Mocker failed to stop. reqSet.size === 0`)
      } else {
        logger(`Mocker failed to stop. Alive connections:\n${[...this.reqSet]}`)
      }

      logger('About to throw an Error')

      signale.error(`Failed to stop mocker!`)
      signale.error(`Possible reasons:`)
      signale.error(`1) navigation happened before all responses completed.`)
      signale.error(`2) some connections are not finished in 20 seconds.`)
      signale.error(`The number of opened connections is ${this.reqSet.size}.\nReqSet:${[...this.reqSet]}`)
      throw new Error(`Failed to stop mocker!`)
    }, 20 * 1000)

    logger('Begining of mocker.stop procedure')

    if (typeof this._startPromise === 'undefined') {
      throw new Error('Cant stop mocker. Probably you didnt start it?')
    }

    let failed = false

    await this._startPromise

    if (this.options.awaitConnectionsOnStop) {
      try {
        await this.connections()
      } catch (err) {
        signale.error(`this.connections was rejected with error. Continue...`, err)
        failed = err
      }
    }

    logger('`Start` promise was resolved, `connections` promise was resolved or rejected')

    clearTimeout(t1)

    await this.removeCloseHandler?.()
    await this.removeRequestHandler?.()
    await this.removeResponseHandler?.()
    this.alive = false

    // @todo how to solve that without closure?
    // Must reject on `connections` reject, but must finish all tasks also
    if (failed) {
      signale.error(`rejecting mocker.stop() promise, because connections promise was rejected`)

      logger(`About to exit from mocker.stop with reject`)

      throw failed
    }

    logger('Interceptor names and matched urls', this._matched)
    this.options.onStop?.({ matched: this._matched })

    logger(`about to exit from mocker.stop with resolve`)
  }
}

export default Teremock
