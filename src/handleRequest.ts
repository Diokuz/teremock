import signale, { debug } from './logger'
import { findInterceptor, parseUrl, assignResponse } from './utils'
import getMockId from './mock-id'
import { Options, DefResponse, Storage, Interceptor, Request, Response } from './types'

// const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:request')

type Params = Options & {
  reqSet: Set<string>
  _onReqStarted: Function
  _onReqsReject: Function
  storage: Storage
}

async function sleep(time) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

type BeforeRespondArg = {
  respond: (response: Response, interceptor: Interceptor) => void
  request: Request
  response: DefResponse
  responseOverrides?: Partial<Response>
  interceptor: Interceptor
  mog: Function
  increment: () => number
}

async function beforeRespond({ respond, request, response, mog, interceptor, increment, responseOverrides }: BeforeRespondArg) {
  let resp: Response

  if (typeof response === 'function') {
    mog(`» response is a function, responding with its returns`)
    resp = await response(request)
    mog(`» response() returns`, resp)
  } else {
    const bodyStr = getBodyStr(response.body)

    mog('» responding with', bodyStr.slice(100))
    // @ts-ignore
    resp = { ...response, body: bodyStr }
  }

  let resultResponse = assignResponse(resp, responseOverrides)

  const ttfb = resultResponse?.ttfb ?? 0
  const actualDelay: number = Array.isArray(ttfb) ? ttfb[increment() % ttfb.length] : ttfb

  mog('» actualDelay', actualDelay)
  await sleep(Math.floor(actualDelay))

  if (resultResponse.status >= 300 && resultResponse.status < 400) {
    const { body, ...rest } = resultResponse

    resultResponse = rest
  }

  respond(resultResponse, interceptor)
}

// Need type string here
// https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#requestrespondresponse
const getBodyStr = (body): string => typeof body === 'string' ? body : JSON.stringify(body ?? '')

export default function createHandler(initialParams) {
  let i = 0
  const increment = () => i++
  logger('creating request handler')

  return async function handleRequest({ request, abort, next, respond }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { interceptors, storage, reqSet, ci, responseOverrides } = params

    const reqParams = { url: request.url, method: request.method, body: request.body }
    logger(`» intercepted request with method "${request.method}" and url "${request.url}"`)
    logger(`request handling for:`, reqParams)
    logger(`request headers :`, request.headers)

    const interceptor = findInterceptor({ interceptors, request })

    if (!interceptor) {
      signale.warn(`interceptor not found, request to "${request.url}" will be aborted`)
      signale.warn(`it is recommended to add interceptors to cover all request from your test app`)
      signale.warn(`see https://github.com/diokuz/teremock#interceptor for details`)

      logger('» interceptor not found, aborting')
      abort('aborted')
      return
    }

    const bodyStr = getBodyStr(request.body)
    const mockId = getMockId({ ...request, naming: interceptor.naming, name: interceptor.name, body: bodyStr })
    const mog = debug(`teremock:${mockId}`)

    mog(`interceptor found`, interceptor)

    if (interceptor.pass) {
      mog(`» interceptor.pass is true, sending it to real server next(interceptor)`)
      next(interceptor)
      return
    }

    if (interceptor.response) {
      mog(`» interceptor.response defined, responding with it`)

      await beforeRespond({
        request,
        response: interceptor.response,
        responseOverrides,
        respond,
        interceptor,
        mog,
        increment,
      })

      return
    }

    // mocks from storage

    params._onReqStarted({ ...parseUrl(request.url), url: request.url, method: request.method, body: request.body })
    reqSet.add(mockId)
    mog('» reqSet is', Array.from(reqSet))

    mog(`» trying to get mock with id "${mockId}"`)

    if (await storage.has(mockId)) {
      mog(`» mock "${mockId}" exists!`)

      const mock = await storage.get(mockId)

      mog(`» successfully read from "${mockId}", responding`)

      await beforeRespond({
        request,
        response: mock.response,
        responseOverrides,
        respond,
        interceptor,
        mog,
        increment,
      })
    } else {
      mog(`» mock does not exist!`)

      if (ci) {
        signale.warn(`mock file not found in ci mode, url is "${request.url}"`)
      } else {
        mog('» about to next()...')
        next(interceptor)
      }
    }
  }
}
