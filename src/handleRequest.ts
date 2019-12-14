import path from 'path'
import debug from 'debug'
import signale from 'signale'
import { shouldOk, shouldNotIntercept, isPassableByDefault } from './utils'
import * as storage from './storage'

const logger = debug('prm:-request')

export default function createHandler(initialParams) {
  logger('Creating request handler')

  return function handleRequest(interceptedRequest, extraParams = {}) {
    const params = { ...initialParams, ...extraParams }

    const {
      pageUrl,
      reqSet,
      workDir,
      mockList,
      okList,
      ci,
      verbose,
      cacheRequests,
      passList,
      queryParams,
      skipQueryParams,
      skipPostParams,
      mockMiss,
      response,
      responseHeaders,
      status,
    } = params

    if (responseHeaders) {
      signale.warn(`options.responseHeaders is deprecated,`)
      signale.warn(`use options.response.headers or mock.response.headers instead.`)
    }

    const url = interceptedRequest.url()
    const method = interceptedRequest.method()
    const postData = interceptedRequest.postData()
    const headers = interceptedRequest.headers()
    const reqParams = { url, method, postData }
    const purl = typeof pageUrl === 'function' ? pageUrl() : pageUrl

    // https://github.com/Diokuz/puppeteer-request-mocker/pull/12
    if (cacheRequests) {
      logger(`» Cached request with method "${method}" and url "${url}"`)
      params._onSetReqCache(interceptedRequest)
    }

    logger(`» Intercepted request with method "${method}" and url "${url}"`)

    if (verbose) {
      signale.info(`Request handling for:\n${reqParams}`)
      signale.info(`Request headers :\n${headers}`)
      signale.info('handleRequest', interceptedRequest)
      signale.info('decodeURIComponent(postData)', decodeURIComponent(postData))
      signale.info('encodeURIComponent(postData)', encodeURIComponent(postData))
    }

    // If url is not in mockList nor okList
    if (shouldNotIntercept(mockList, okList, url)) {
      logger('» shouldNotIntercept')
      let isPassable

      if (passList && passList.length) {
        isPassable = passList.find((passUrl) => url.startsWith(passUrl))
      } else {
        isPassable = isPassableByDefault(purl, url, method)
      }

      if (!isPassable && !interceptedRequest.isNavigationRequest()) {
        signale.error(`Url ${url} is not from the options.passList, aborting request`)
        signale.error(`pageUrl is "${purl}", passList is "${passList}"`)
        interceptedRequest.abort('aborted')
      } else {
        logger(`» Url is from pass list, sending it to real server`)
        interceptedRequest.continue()
      }

      return
    }

    // Just say OK, dont save the mock
    if (shouldOk(mockList, okList, url)) {
      logger('» shouldOk. Skipping. Responding with 200-OK')

      interceptedRequest.respond({
        headers: responseHeaders,
        ...response,
        body: 'OK',
        status: 200,
      })

      return
    }

    const mock_params = {
      url,
      method,
      headers,
      postData,
      queryParams,
      skipQueryParams,
      skipPostParams,
      verbose,
      workDir,
    }

    const fn = storage.name(mock_params)

    params._onReqStarted()
    reqSet.add(fn)
    debug('prm:connections:add')(
      path.basename(fn),
      Array.from(reqSet).map((f: string) => path.basename(f))
    )

    logger(`» Trying to read from file ${fn}`)

    storage
      .read(fn)
      .then((rawData: any) => {
        let body = rawData
        let headers = {}

        try {
          const res = JSON.parse(rawData).response
          body = res.body
          headers = res.headers
        } catch (e) {
          logger(`« Failed to parse mock as json, continue as text`)
          body = rawData.substring(rawData.indexOf('\n\n') + 2)
          // Old default for options.response.headers for old format mocks
          headers = (response && response.headers) ||
            responseHeaders || {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            }
          logger(`« Body starts with ${body.substring(0, 100)}`)
        }

        logger(`« Successfully read from file`)

        interceptedRequest.respond({
          headers: {
            // mock level headers have higher priprity than global options level headers
            ...responseHeaders,
            ...headers,
          },
          body: typeof body === 'string' ? body : JSON.stringify(body),
          status,
          ...response,
        })
      })
      .catch((e) => {
        logger(`« Failed to read: ${e.fn}`)

        if (ci) {
          if (mockMiss === 'throw') {
            signale.error(`« Mock not found in CI mode! Rejecting. "${e.fn}" ${url}`)

            params._onReqsReject('MONOFO')
          } else if (typeof mockMiss === 'number') {
            interceptedRequest.respond({
              code: mockMiss,
              body: 'Mock not found',
            })
          } else if (typeof mockMiss === 'function') {
            mockMiss((response) => {
              interceptedRequest.respond(response)
            })
          } else {
            params._onReqsReject(`Wrong mockMiss value. Check mocker.start() params and read the docks.`)
          }
        } else {
          logger('« About to interceptedRequest.continue...')
          interceptedRequest.continue()
        }
      })
  }
}
