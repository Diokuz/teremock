/*
 * It is a singleton, the only instance is located in `exports`
 * @todo instantiate for each test suite explicitly
 */

import debug from 'debug'
import FileStorage from './storage'
import signale from './logger'
import createRequestHandler from './handleRequest'
import createResponseHandler from './handleResponse'
import { isInterceptorMatched, userOptionsToOptions, userInterceptorToInterceptor, AsyncPendingQueue } from './utils'
import PlaywrightDriver from './pw-driver'
import { DEFAULT_OPTIONS } from './consts'

import type { Options, UserOptions, Driver, Storage, UserInterceptor, Interceptor, SpyTuple, Spy, Request, Response } from './types'

const logger = debug('teremock')

function noop() {}

class Teremock {
  private defaultOptions: Options
  private extraParams?: Partial<Options>
  private options: Options
  private storage: Storage
  /** set of urls of currently active connections. all connections became inactive after response. */
  private reqSet: Set<string>
  /** set of urls of currently active connections, which cleared only on connections resolve */
  private reqSetRet: Set<string>
  private alive: boolean
  private reqsPromise?: Promise<any>
  private removeCloseHandler?: Function
  private removeRequestHandler?: Function
  private removeResponseHandler?: Function
  protected driver: Driver | undefined
  private _startPromise?: Promise<any>
  private _resolveReqs: Function
  private _spies: SpyTuple[]
  private _interceptors: Record<string, Interceptor>
  private _matched: Map<string, string[]>
  private _requestPendingQueue?: AsyncPendingQueue
  private _responsePendingQueue?: AsyncPendingQueue

  constructor(opts?: { storage?: Storage, driver?: Driver }) {
    signale.debug(`new Mocker`)
    this.defaultOptions = Object.assign({}, DEFAULT_OPTIONS)
    this.options = this.defaultOptions

    this.alive = false
    this._spies = []
    this._interceptors = {}
    this._resolveReqs = noop
    this._matched = new Map()
    this.storage = opts?.storage ?? new FileStorage()
    this.driver = opts?.driver

    this.reqSet = new Set()
    this.reqSetRet = new Set()
  }

  private _onAnyReqStart(req: Request) {
    if (this.reqSet.size === 0) {
      this.reqsPromise = new Promise((resolve) => {
        this._resolveReqs = () => {
          resolve(Array.from(this.reqSetRet))
          this.reqSetRet.clear()
        }
      })
    }

    if (this._spies.length > 0) {
      this._spies.forEach(([interceptor, spy]) => {
        if (isInterceptorMatched(interceptor, req)) {
          spy.called = true
          spy.callCount++
          spy.calledOnce = spy.callCount === 1

          if (req.id !== -1 && req.id && req.order && req.timestamp) {
            spy.events.push({
              requestTimestamp: req.timestamp,
              requestOrder: req.order,
              requestId: req.id
            })
          }
        }
      })
    }
  }
  private _onAnyReqEnd(req: Request, resp: Response) {
    if (this._spies.length > 0) {
      this._spies.forEach(([interceptor, spy]) => {
        if (isInterceptorMatched(interceptor, req)) {
          if (req.id !== -1 && req.id) {
            const eventInfo = spy.events.find(obj => obj.requestId === req.id)
            if (eventInfo) {
              eventInfo.responseTimestamp = resp.timestamp
              eventInfo.responseOrder = resp.order
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

    let resolveStartPromise: (_v?: any) => void

    this._startPromise = new Promise((resolve) => {
      resolveStartPromise = resolve
    })
    this.alive = true
    this.options = userOptionsToOptions(this.defaultOptions, userOptions)
    this.options.wd && this.storage.setWd?.(this.options.wd)
    this.driver = this.driver ?? new PlaywrightDriver({ page: userOptions.page })
    await this.driver.setRequestInterception(true)
    this._spies = []
    this._interceptors = this.options.interceptors
    this._matched = new Map()

    const logParams = Object.assign({}, this.options)
    logger('Mocker starts with resulting params:', logParams)

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
      _onMatch: (interceptor: Interceptor, req: any) => {
        if (!this._matched.has(interceptor.name)) {
          this._matched.set(interceptor.name, [])
        }

        this._matched.get(interceptor.name)!.push(req.url)
      }
    })

    this._requestPendingQueue = new AsyncPendingQueue()

    const pureResponseHandler = createResponseHandler({
      ...this.options,
      interceptors: this._interceptors,
      storage: this.storage,
      reqSet: this.reqSet,
      _onReqCompleted: (req: Request, resp: Response) => this._onAnyReqEnd(req, resp),
      _onReqsCompleted: () => this._resolveReqs(),
    })

    this._responsePendingQueue = new AsyncPendingQueue()

    logger('Handlers created, params validated')

    // Intercepting all requests and respinding with mocks
    this.removeRequestHandler = await this.driver.onRequest(async (ir) => {
      // driver may calls onRequest callback synchronously,
      // we using here AsyncPendingQueue who can track pending promises
      try {
        await this._requestPendingQueue!.add(pureRequestHandler(ir, {
          ...this.extraParams,
          interceptors: this._interceptors,
        }))
      } catch (e) {
        signale.error(`There is error in request handler:`)
        signale.error(e)
      }
    })

    // Writing mocks on real responses to filesystem
    this.removeResponseHandler = await this.driver.onResponse(async (ir) => {
      // driver may calls onResponse callback synchronously,
      // we using here AsyncPendingQueue who can track pending promises
      try {
        await this._responsePendingQueue!.add(pureResponseHandler(ir, {
          ...this.extraParams,
          interceptors: this._interceptors,
        }))
      } catch (e) {
        signale.error(`There is error in response handler:`)
        signale.error(e)
      }
    })

    logger('_startPromise about to resolve (Request interception enabled, listeners added)')

    resolveStartPromise!()

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
      } catch (err: any) {
        signale.error(`this.connections was rejected with error. Continue...`, err)
        failed = err
      }
    }

    logger('`Start` promise was resolved, `connections` promise was resolved or rejected')

    clearTimeout(t1)

    const requestHandlerErrorsCount = await this._requestPendingQueue?.awaitPending()
    if (requestHandlerErrorsCount) {
      throw new Error(`There were ${requestHandlerErrorsCount} errors in the request handler. See error output above.`)
    }
    const responseHandlerErrorsCount = await this._responsePendingQueue?.awaitPending()
    if (responseHandlerErrorsCount) {
      throw new Error(`There were ${responseHandlerErrorsCount} errors in the response handler. See error output above.`)
    }

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
