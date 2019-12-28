import debug from 'debug'
import signale from './logger'
import { findInterceptor, parseUrl } from './utils'
import getMockId from './mock-id'
import { Options, Response, Storage } from './types'

// const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:request')

type Params = Options & {
  reqSet: Set<string>
  _onReqStarted: Function
  _onReqsReject: Function
  pageUrl: () => string
  storage: Storage
}

async function sleep(time) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

async function respondWithDelay(respond, resp: Response) {
  const ttfb = resp?.ttfb ?? 0
  const actualDelay: number = typeof ttfb === 'function' ? ttfb() : ttfb

  logger('actualDelay', actualDelay)

  await sleep(Math.floor(actualDelay))

  const bodyStr = getBodyStr(resp.body)

  respond({ ...resp, body: bodyStr })
}

// Need type string here
// https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#requestrespondresponse
const getBodyStr = (body): string => typeof body === 'string' ? body : JSON.stringify(body)

export default function createHandler(initialParams) {
  logger('Creating request handler')

  return async function handleRequest({ request, abort, next, respond }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { interceptors, storage, reqSet, ci, response: globalResp } = params

    const reqParams = { url: request.url, method: request.method, body: request.body }
    logger(`» intercepted request with method "${request.method}" and url "${request.url}"`)
    logger(`request handling for:`, reqParams)
    logger(`request headers :`, request.headers)

    const interceptor = findInterceptor({ interceptors, request })

    if (!interceptor) {
      logger('» interceptor not found, aborting')
      abort('aborted')
      return
    }

    if (interceptor.pass) {
      logger(`» mock.pass is true, sending it to real server`)
      next()
      return
    }

    if (interceptor.response) {
      logger(`» mock.response defined, responding with it`)
      await respondWithDelay(respond, interceptor.response)
      return
    }

    // mocks from storage

    const bodyStr = getBodyStr(request.body)
    const mockId = getMockId({ ...request, naming: interceptor.hash, name: interceptor.name, body: bodyStr })

    params._onReqStarted({ ...parseUrl(request.url), url: request.url, method: request.method, body: request.body })
    reqSet.add(mockId)
    debug('teremock:connections:add')(mockId, Array.from(reqSet))

    logger(`» trying to get mock with id "${mockId}"`)

    if (await storage.has(mockId)) {
      logger(`» mock exists!`)

      const mock = await storage.get(mockId)
      const resp = { ...mock.response, ...globalResp }

      logger(`« successfully read from "${mockId}", responding`)

      await respondWithDelay(respond, resp)
    } else {
      logger(`» mock does not exist!`)

      if (ci) {
        signale.warn(`mock file not found in ci mode, url is "${request.url}"`)
      } else {
        logger('« about to next()...')
        next()
      }
    }
  }
}
