import debug from 'debug'
import signale from './logger'
import { isCapturable, isPassable, parseUrl } from './utils'
import getMockId from './mock-id'
import { Options } from './types'

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:-request')

type Params = Options & {
  reqSet: Set<any>
  _onSetReqCache: Function
  _onReqStarted: Function
  _onReqsReject: Function
  pageUrl: () => string
}

export default function createHandler(initialParams) {
  logger('Creating request handler')

  return function handleRequest(interceptedRequest, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }

    const { storage, pageUrl, reqSet, wd, ci, pass, naming, mockMiss, response } = params

    const url: string = interceptedRequest.url()
    const method: string = interceptedRequest.method()
    const postData = interceptedRequest.postData()
    const headers = interceptedRequest.headers()
    const reqParams = { url, method, body: postData }
    const purl = typeof pageUrl === 'function' ? pageUrl() : pageUrl

    logger(`» Intercepted request with method "${method}" and url "${url}"`)

    signale.debug(`Request handling for:\n${reqParams}`)
    signale.debug(`Request headers :\n${headers}`)
    signale.debug('decodeURIComponent(postData)', decodeURIComponent(postData))
    signale.debug('encodeURIComponent(postData)', encodeURIComponent(postData))

    if (!isCapturable({ capture: params.capture, request: { url, method } })) {
      logger('» not for capturing')

      if (interceptedRequest.isNavigationRequest()) {
        logger(`» navigation request, continue without checking in options.pass`)
        interceptedRequest.continue()
        return
      }

      if (isPassable({ pass, pageUrl: purl, reqUrl: url, method })) {
        logger(`» url is from pass list, sending it to real server`)
        interceptedRequest.continue()
        return
      }

      signale.error(`url ${url} is not from the options.pass, aborting request`)
      signale.error(`pageUrl is "${purl}", pass is "${pass}"`)
      interceptedRequest.abort('aborted')

      return
    }

    // is for capturing from here!

    const mock_params = {
      url,
      method,
      headers,
      body: postData,
      naming,
      wd,
    }

    const mockId = getMockId(mock_params)

    params._onReqStarted({ ...parseUrl(url), url, method, body: postData })
    reqSet.add(mockId)
    debug('teremock:connections:add')(mockId, Array.from(reqSet))

    logger(`» trying to get mock with id "${mockId}"`)

    storage
      .get(mockId, { wd })
      .then(async (rawData: any) => {
        const mock = JSON.parse(rawData)
        const res = mock.response
        const mockBody = res.body
        const headers = res.headers

        logger(`« successfully read from file`)

        await sleep(params.delay ?? mock.delay ?? 0)

        interceptedRequest.respond({
          headers,
          body: typeof mockBody === 'string' ? mockBody : JSON.stringify(mockBody),
          ...response,
        })
      })
      .catch((e) => {
        logger(`« failed to read: ${e.fn}`)

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
