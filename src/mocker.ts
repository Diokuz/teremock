/*
 * It is a singleton, the only instance is located in `exports`
 * @todo instantiate for each test suite explicitly
 */

import path from 'path'
import makeDir from 'make-dir'
import debug from 'debug'
import isCi from 'is-ci'
import signale from './logger'
import createRequestHandler from './handleRequest'
import createResponseHandler from './handleResponse'
import { Options, UserOptions } from './types'

const logger = debug('prm')

const defaultParams: Options = {
  wd: path.resolve(process.cwd(), '__teremocks__'),
  // @ts-ignore
  page: typeof page === 'undefined' ? null : page,
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
  okList: [],
  mockList: [],
  passList: [],
  force: false,
  // https://github.com/facebook/jest/blob/c6512ad1b32a5d22aab9937300aa61aa87f76a27/packages/jest-cli/src/cli/args.js#L128
  ci: isCi, // Same behaviour as in Jest
  verbose: false,
  cacheRequests: false,
  pagesSet: new Set(), // Singleton by default
  mockMiss: 500,
  awaitConnectionsOnStop: false,
}

class Mocker {
  constructor(customDefaultParams = {}) {
    this.defaultParams = Object.assign({}, defaultParams, customDefaultParams)
  }

  page: any
  defaultParams: Options
  extraParams: Object
  params: any
  reqSet: Set<any>
  cachedReqs: Map<string, any>
  alive: boolean
  reqsPromise: Promise<any>
  requestHandler: Function
  responseHandler: Function
  onCloseHandler: Function | null
  _startPromise: Promise<any> | void
  _resolveReqs: Function
  _rejectReqs: Function

  _getParams(userOptions: UserOptions): Options {
    let resultMockList: string[] = []
    let resultOkList: string[] = []

    if (typeof userOptions.mockList === 'string') {
      resultMockList = userOptions.mockList.split(',')
    } else if (Array.isArray(userOptions.mockList)) {
      resultMockList = userOptions.mockList
    }

    if (typeof userOptions.okList === 'string') {
      resultOkList = userOptions.okList.split(',')
    } else if (userOptions.okList === null) {
      resultOkList = []
    }

    return { ...this.defaultParams, ...userOptions, mockList: resultMockList, okList: resultOkList }
  }

  _validate() {
    const { page, pagesSet } = this.params

    if (!page) {
      throw new Error('Option "page" and global.page – both are not defined')
    }

    if (pagesSet.has(page)) {
      throw new Error(`Second "mocker.start()" call on the same page!
        Probably you didn\'t call "mocker.stop()".`)
    }

    pagesSet.add(page)
  }

  _onAnyReqStart() {
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
  }

  /*
   * Starts to intercept requests
   */
  start(userOptions: UserOptions) {
    this.reset()
    this.alive = true
    this.params = this._getParams(userOptions)

    const logParams = Object.assign({}, this.params, { page: '...' })
    logger('Mocker starts with resulting params:')
    logger(logParams)

    this._validate()
    this.page = this.params.page
    this.reqSet = new Set()
    this.cachedReqs = new Map()
    this.onCloseHandler = () => {
      if (this.cachedReqs.size !== 0) {
        this.cachedReqs.clear()
      }
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
    }
    // Clear on any page close, or sometimes you loose some responses on unload, and `connections` will never resolves
    this.params.page.on('close', this.onCloseHandler)
    const pureRequestHandler = createRequestHandler({
      ...this.params,
      reqSet: this.reqSet,
      _onSetReqCache: (req) => this.cachedReqs.set(`${req._url}_${req._method}`, req._postData),
      _onReqStarted: () => this._onAnyReqStart(),
      _onReqsReject: (...args) => this._rejectReqs(...args),
      pageUrl: () => this.params.page.url(),
    })
    this.requestHandler = (ir) => pureRequestHandler(ir, this.extraParams)
    const pureResponseHandler = createResponseHandler({
      ...this.params,
      reqSet: this.reqSet,
      _onReqsCompleted: () => this._resolveReqs(),
      _onReqsReject: (...args) => this._rejectReqs(...args),
    })
    this.responseHandler = (ir) => pureResponseHandler(ir, this.extraParams)

    logger('Handlers created, params validated')

    this._startPromise = makeDir(this.params.wd)
      .then(() => {
        logger(`Successfully created working directory ${this.params.wd}`)

        return this.page.setRequestInterception(true)
      })
      .then(() => {
        // Intercepting all requests and respinding with mocks
        this.page.on('request', this.requestHandler)

        // Writing mocks on real responses to filesystem
        this.page.on('response', this.responseHandler)

        logger('_startPromise about to resolve (Request interception enabled, listeners added)')
      })
      .catch((e) => {
        logger(`Unknown error from puppeteer: ${e.message}`)
      })

    return this._startPromise
  }

  set(key, value) {
    this.extraParams = this.extraParams || {}
    this.extraParams[key] = value
  }

  unset(key) {
    if (this.extraParams && typeof this.extraParams[key] !== 'undefined') {
      this.extraParams[key] = undefined
    }
  }

  reset() {
    this.extraParams = {}
  }

  /*
   * Resolves when all mocked connections are completed
   * @deprecated
   */
  connections() {
    signale.warn('mocker.connections() is deprecated and will be removed')
    signale.warn('try to await explicit UI changes, not connections')

    if (typeof this._startPromise === 'undefined') {
      throw new Error('Cant await connections. Probably you didnt start the mocker?')
    }

    return this.reqsPromise || Promise.resolve()
  }

  /*
   * Waits for all connections to be completed and removes all handlers from the page
   */
  stop() {
    this.cachedReqs.clear()
    if (!this.alive) {
      // Async, because jest suppress Errors in `after` callbacks
      setTimeout(() => {
        throw new Error(`Trying to stop already stopped mocker! Did you call 'mocker.stop()' twice?`)
      })
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

    // If any request is not mocked, return promise will reject
    return this._startPromise
      .then(() => {
        if (this.params.awaitConnectionsOnStop) {
          return this.connections()
        }
      })
      .catch((err) => {
        signale.error(`this.connections was rejected with error. Continue...`, err)
        failed = err
      })
      .then(() => {
        logger('`Start` promise was resolved, `connections` promise was resolved or rejected')

        clearTimeout(t1)

        this.params.page.removeListener('request', this.requestHandler)
        this.params.page.removeListener('response', this.responseHandler)
        this.params.page.removeListener('close', this.onCloseHandler)

        return this.params.page.setRequestInterception(false)
      })
      .then(() => {
        logger('requestInterception disabled, fail timeout cleared')

        this.params.pagesSet.delete(this.params.page)

        this._startPromise = undefined
        this.params = undefined
        this.alive = false
        this.onCloseHandler = null

        logger(`Mocker full stop. Period.`)

        // @todo how to solve that without closure?
        // Must reject on `connections` reject, but must finish all tasks also
        if (failed) {
          signale.error(`Rejecting mocker.stop() promise, because connections promise was rejected`)

          logger(`About to exit from mocker.stop with reject`)

          return Promise.reject(failed)
        }

        logger(`About to exit from mocker.stop with resolve`)
      })
  }

  getCachedRequests() {
    return this.cachedReqs
  }
}

export default Mocker
