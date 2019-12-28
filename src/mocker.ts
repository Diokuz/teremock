/*
 * It is a singleton, the only instance is located in `exports`
 * @todo instantiate for each test suite explicitly
 */

import debug from 'debug'
import FileStorage from './storage'
import signale from './logger'
import createRequestHandler from './handleRequest'
import createResponseHandler from './handleResponse'
import { Options, UserOptions, Driver, Storage, UserInterceptor, Interceptor } from './types'
import { isSpyMatched, userOptionsToOptions, userInterceptorToInterceptor } from './utils'
import PuppeteerDriver from './puppeteer'
import { DEFAULT_OPTIONS } from './consts'
import { humanize } from './words-hash'

const logger = debug('teremock')



function noop() {}

class Mocker {
  private defaultOptions: Options
  private extraParams: UserOptions
  private options: Options
  private storage: Storage
  private reqSet: Set<string>
  private alive: boolean
  private reqsPromise: Promise<any>
  private removeCloseHandler: Function | null
  private removeRequestHandler: Function | null
  private removeResponseHandler: Function | null
  private driver: Driver
  private _startPromise: Promise<any> | void
  private _resolveReqs: Function
  private _rejectReqs: Function
  private _spies: any[]
  private _interceptors: Record<string, Interceptor>

  constructor(opts?: any) {
    signale.debug(`new Mocker`)
    this.defaultOptions = Object.assign({}, DEFAULT_OPTIONS)

    this._spies = []
    this._interceptors = {}
    this._resolveReqs = noop
    this._rejectReqs = noop
    this.storage = opts?.storage ?? new FileStorage()
  }

  private _onAnyReqStart(req) {
    if (this.reqSet.size === 0) {
      this.reqsPromise = new Promise((resolve, reject) => {
        this._resolveReqs = resolve
        this._rejectReqs = (...args) => {
          console.trace()
          signale.log('args', args)
          reject(...args)
        }
      })
    }

    if (this._spies.length > 0) {
      this._spies.forEach(([spyFilter, spy]) => {
        if (isSpyMatched(spyFilter, req)) {
          spy.called = true
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
    this.options.wd && this.storage.setWd(this.options.wd)
    this.driver = new PuppeteerDriver({ page: userOptions.page })
    this._spies = []
    this._interceptors = this.options.interceptors

    const logParams = Object.assign({}, this.options)
    logger('Mocker starts with resulting params:', logParams)

    this.reqSet = new Set()
    // Clear on any page close, or sometimes you loose some responses on unload, and `connections` will never resolves
    this.removeCloseHandler = this.driver.onClose?.(() => {
      if (this.reqSet.size !== 0) {
        if (!this.options.ci) {
          signale.error(`Some connections was not completed, but navigation happened.`)
          signale.error(`That is bad, mkay? Because you have a race: server response and navigation`)
          signale.error(`That will lead to heisenberg MONOFO errors in case when response will win the race`)
          signale.error(`Alive connections:\n${[...this.reqSet]}`)
          throw new Error(`Some connections was not completed, but navigation happened.`)
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
      reqSet: this.reqSet,
      _onReqStarted: (req) => this._onAnyReqStart(req),
      _onReqsReject: (...args) => this._rejectReqs(...args),
      pageUrl: () => this.driver.getPageUrl(),
    })

    const pureResponseHandler = createResponseHandler({
      ...this.options,
      interceptors: this._interceptors,
      storage: this.storage,
      reqSet: this.reqSet,
      _onReqsCompleted: () => this._resolveReqs(),
      _onReqsReject: (...args) => this._rejectReqs(...args),
    })

    logger('Handlers created, params validated')

    // Intercepting all requests and respinding with mocks
    this.removeRequestHandler = this.driver.onRequest((ir) => pureRequestHandler(ir, {
      ...this.extraParams,
      interceptors: this._interceptors,
    }))

    // Writing mocks on real responses to filesystem
    this.removeResponseHandler = this.driver.onResponse((ir) => pureResponseHandler(ir, {
      ...this.extraParams,
      interceptors: this._interceptors,
    }))

    logger('_startPromise about to resolve (Request interception enabled, listeners added)')

    resolveStartPromise()

    return this._startPromise
  }

  public add(userInterceptor: UserInterceptor, overwrite = false) {
    const name = userInterceptor.name || humanize(Math.random() + '', 1)
    const interceptor = userInterceptorToInterceptor(userInterceptor, name)

    if (name in this._interceptors && !overwrite) {
      signale.error(`interceptor with name "${name}" already exists, pass second arg true if you want to overwrite it`)
      return
    }

    this._interceptors = {
      ...this._interceptors,
      [name]: interceptor,
    }

    // @todo support restoring overwritten names
    return () => {
      const { [name]: omit, ...rest } = this._interceptors
      this._interceptors = rest
    }
  }

  /*
   * Resolves when all mocked connections are completed
   * @deprecated
   */
  public connections() {
    signale.warn('mocker.connections() is deprecated and will be removed')
    signale.warn('try to await explicit UI changes, not connections')

    if (typeof this._startPromise === 'undefined') {
      throw new Error('Cant await connections. Probably you didnt start the mocker?')
    }

    return this.reqsPromise || Promise.resolve()
  }

  public spy(spyFilter: any) {
    const spy = { called: false }

    this._spies.push([spyFilter, spy])

    return spy
  }

  /*
   * Waits for all connections to be completed and removes all handlers from the page
   */
  public async stop(opts: any = {}) {
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

    this.removeCloseHandler?.()
    this.removeRequestHandler?.()
    this.removeResponseHandler?.()
    this.alive = false

    // @todo how to solve that without closure?
    // Must reject on `connections` reject, but must finish all tasks also
    if (failed) {
      signale.error(`rejecting mocker.stop() promise, because connections promise was rejected`)

      logger(`About to exit from mocker.stop with reject`)

      throw failed
    }

    logger(`about to exit from mocker.stop with resolve`)
  }
}

export default Mocker
