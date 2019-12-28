/*
 * It is a singleton, the only instance is located in `exports`
 * @todo instantiate for each test suite explicitly
 */

import path from 'path'
import makeDir from 'make-dir'
import debug from 'debug'
import isCi from 'is-ci'
import Storage from './storage'
import signale from './logger'
import createRequestHandler from './handleRequest'
import createResponseHandler from './handleResponse'
import { Options, UserOptions, Driver } from './types'
import { isSpyMatched } from './utils'
import PuppeteerDriver from './puppeteer'

const logger = debug('teremock')

// @ts-ignore
const defaultParams: Options = {
  wd: path.resolve(process.cwd(), '__teremocks__'),
  // @ts-ignore
  page: typeof page === 'undefined' ? null : page,
  capture: {
    urls: ['*'],
    methods: ['*'],
  },
  naming: {},
  pass: {
    urls: ['same-origin'], // special keyword, not an url
    methods: ['get'],
  },
  // storage, // see constructor
  skipResponseHeaders: [
    'date',
    'expires',
    'last-modified',
    'x-powered-by',
    'etag',
    'cache-control',
    'content-length',
    'server',
  ],
  // force: false,
  // https://github.com/facebook/jest/blob/c6512ad1b32a5d22aab9937300aa61aa87f76a27/packages/jest-cli/src/cli/args.js#L128
  ci: isCi, // Same behaviour as in Jest
  mockMiss: 500,
  awaitConnectionsOnStop: false,
}

function noop() {}

class Mocker {
  private defaultParams: Options
  private extraParams: UserOptions
  private params: Options
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
  private _mocks: any[]

  constructor(customDefaultParams = {}) {
    this.defaultParams = Object.assign({}, defaultParams, customDefaultParams)
    this._spies = []
    this._mocks = []
    this._resolveReqs = noop
    this._rejectReqs = noop
  }

  private _getParams(userOptions: UserOptions): Options {
    const resultCapture = {
      ...this.defaultParams.capture,
      ...userOptions.capture,
    }
    const resultPass = {
      ...this.defaultParams.pass,
      ...userOptions.pass,
    }

    const staticOptions = {
      ...this.defaultParams,
      ...userOptions,
      capture: resultCapture,
      pass: resultPass,
    }

    return {
      ...staticOptions,
      storage: staticOptions.storage || new Storage({ wd: staticOptions.wd, ci: staticOptions.ci }),
    }
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
    let resolveStartPromise
    this._startPromise = new Promise((resolve) => {
      resolveStartPromise = resolve
    })
    this.alive = true
    this.params = this._getParams(userOptions)
    await makeDir(this.params.wd)
    this.driver = new PuppeteerDriver({ page: this.params.page })
    this._spies = []
    this._mocks = []

    const logParams = Object.assign({}, this.params, { page: '...' })
    logger('Mocker starts with resulting params:')
    logger(logParams)

    this.reqSet = new Set()
    // Clear on any page close, or sometimes you loose some responses on unload, and `connections` will never resolves
    this.removeCloseHandler = this.driver.onClose?.(() => {
      if (this.reqSet.size !== 0) {
        if (!this.params.ci) {
          signale.error(`Some connections was not completed, but navigation happened.`)
          signale.error(`That is bad, mkay? Because you have a race: server response and navigation`)
          signale.error(`That will lead to heisenberg MONOFO errors in case when response will win the race`)
          signale.error(`Alive connections:\n${[...this.reqSet]}`)
          throw new Error(`Some connections was not completed, but navigation happened.`)
        }
        this.reqSet.clear()
        this._resolveReqs()
      }
    })

    const pureRequestHandler = createRequestHandler({
      ...this.params,
      reqSet: this.reqSet,
      _onReqStarted: (req) => this._onAnyReqStart(req),
      _onReqsReject: (...args) => this._rejectReqs(...args),
      pageUrl: () => this.params.page.url(),
    })

    const pureResponseHandler = createResponseHandler({
      ...this.params,
      reqSet: this.reqSet,
      _onReqsCompleted: () => this._resolveReqs(),
      _onReqsReject: (...args) => this._rejectReqs(...args),
    })

    logger('Handlers created, params validated')

    // Intercepting all requests and respinding with mocks
    this.removeRequestHandler = this.driver.onRequest((ir) => pureRequestHandler(ir, this.extraParams, this._mocks))

    // Writing mocks on real responses to filesystem
    this.removeResponseHandler = this.driver.onResponse((ir) => pureResponseHandler(ir, this.extraParams))

    logger('_startPromise about to resolve (Request interception enabled, listeners added)')

    resolveStartPromise()

    return this._startPromise
  }

  public mock(filterArg, responseArg) {
    const defaultResponse = {
      status: 200,
      headers: {},
      body: {},
    }
    let filter = filterArg
    let response = responseArg

    if (typeof filterArg === 'string') {
      filter = { baseUrl: filterArg }
    }

    if (!('body' in response)) {
      response = { ...defaultResponse, body: responseArg }
    }

    const mock = [filter, response]

    this._mocks.push(mock)

    return () => this._mocks = this._mocks.filter(m => m !== mock)
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
  public async stop() {
    if (!this.alive) {
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

    if (this.params.awaitConnectionsOnStop) {
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
