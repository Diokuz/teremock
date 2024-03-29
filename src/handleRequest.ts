import signale, { debug } from './logger'
import { findInterceptor, assignResponse, getBody, getQuery, loggerTrace } from './utils'
import { DEFAULT_RESP_HEADERS } from './consts'

import type { Options, DefResponse, Storage, Interceptor, Request, Response, DriverRequest } from './types'

// const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:request')

export interface Params extends Options {
  reqSet: { add: (x: string) => void; get: () => Set<string> }
  _onReqStarted: (request: Request) => void
  _onMatch: (interceptor: Interceptor, req: Request) => void
  storage: Storage
}

async function sleep(time: number) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

export interface BeforeRespondArg {
  respond: (response: Response, interceptor: Interceptor) => Promise<void>
  request: Request
  response: DefResponse
  mockedResponse?: Response
  responseOverrides?: Partial<Response>
  interceptor: Interceptor
  mog: Function
  increment: () => number
}

async function beforeRespond({
  respond,
  request,
  response,
  mockedResponse,
  mog,
  interceptor,
  increment,
  responseOverrides,
}: BeforeRespondArg) {
  let partResp: Partial<Response>

  if (typeof response === 'function') {
    const argRequest = {
      ...request,
      query: getQuery(request.url),
    }
    mog(`» response is a function, responding with its returns`)
    partResp = await response(argRequest, mockedResponse)
    mog(`» response() returns`, partResp)
  } else {
    partResp = response
  }

  const bodyStrOrUnd = getBody(partResp.body)

  mog('» responding with', (bodyStrOrUnd ?? '').slice(0, 100))
  // @ts-ignore
  const resp: Response = {
    ...partResp,
    headers: {
      ...DEFAULT_RESP_HEADERS,
      ...partResp.headers,
    },
    body: bodyStrOrUnd,
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

  await respond(resultResponse, interceptor)
}

export default function createHandler(initialParams: Params) {
  let i = 0
  const increment = () => i++
  logger('creating request handler')

  return async function handleRequest({ request, abort, next, respond }: DriverRequest, extraParams: Partial<Params> = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { interceptors, storage, reqSet, ci, responseOverrides, getMockId, _onMatch } = params

    const reqParams = { url: request.url, method: request.method, body: request.body, headers: request.headers }

    loggerTrace(`${request.url} ← handling request`)
    logger(`» intercepted request with method "${request.method}" and url "${request.url}"`)
    logger(`request handling for:`, reqParams)
    logger(`request headers :`, request.headers)

    const interceptor = findInterceptor({ interceptors, request })

    if (!interceptor) {
      signale.warn(`interceptor not found, request to "${request.url}" will be aborted`)
      signale.warn(`it is recommended to add interceptors to cover all request from your test app`)
      signale.warn(`see https://github.com/diokuz/teremock#interceptor for details`)

      logger('» interceptor not found, aborting')
      await abort('aborted')
      return
    }

    _onMatch(interceptor, request)

    const mockId = getMockId({ ...request, naming: interceptor.naming ?? {}, name: interceptor.name, body: getBody(request.body) })
    const mog = debug(`teremock:${mockId}`)

    mog(`interceptor found`, interceptor)

    if (interceptor.pass) {
      loggerTrace(`${request.url} ← passing to real server`)
      mog(`» interceptor.pass is true, sending it to real server next(interceptor)`)
      await next(interceptor)
      return
    }

    params._onReqStarted(request)
    reqSet.add(mockId)
    mog('» reqSet is', Array.from(reqSet.get()))

    // mocks from storage
    mog(`» trying to get mock with id "${mockId}"`)

    if (await storage.has(mockId)) {
      mog(`» mock "${mockId}" exists!`)

      const mock = await storage.get(mockId)

      loggerTrace(`${request.url} ← mock ${mockId} found in storage`)
      mog(`» successfully read from "${mockId}", responding`)

      await beforeRespond({
        request,
        response: interceptor.response || mock.response,
        mockedResponse: mock.response,
        responseOverrides,
        respond,
        interceptor,
        mog,
        increment,
      })

      return
    }

    const needMockInResponseFn = typeof interceptor.response === 'function' && interceptor.response.length === 2
    if (interceptor.response && !needMockInResponseFn) {
      loggerTrace(`${request.url} ← inline response`)
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

    loggerTrace(`${request.url} ← mock not found in storage`)
    mog(`» mock does not exist!`, ci)

    if (ci) {
      signale.warn(`mock file not found in ci mode, url is "${request.url}"`)
    } else {
      mog('» about to next()...')
      await next(interceptor)
    }
  }
}
