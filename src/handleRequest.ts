import signale, { debug } from './logger'
import { findInterceptor, parseUrl, assignResponse, getBody, getQuery, loggerTrace } from './utils'
import { Options, DefResponse, Storage, Interceptor, Request, Response } from './types'
import { DEFAULT_RESP_HEADERS } from './consts'

// const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:request')

type Params = Options & {
  reqSet: { add: (x: string) => void; get: () => Set<string> }
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

async function beforeRespond({
  respond,
  request,
  response,
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
    partResp = await response(argRequest)
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

  respond(resultResponse, interceptor)
}

export default function createHandler(initialParams) {
  let i = 0
  const increment = () => i++
  logger('creating request handler')

  return async function handleRequest({ request, abort, next, respond }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { interceptors, storage, reqSet, ci, responseOverrides, getMockId } = params

    const reqParams = { url: request.url, method: request.method, body: request.body }

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
      abort('aborted')
      return
    }

    const mockId = getMockId({ ...request, naming: interceptor.naming, name: interceptor.name, body: getBody(request.body) })
    const mog = debug(`teremock:${mockId}`)

    mog(`interceptor found`, interceptor)

    if (interceptor.pass) {
      loggerTrace(`${request.url} ← passing to real server`)
      mog(`» interceptor.pass is true, sending it to real server next(interceptor)`)
      next(interceptor)
      return
    }

    params._onReqStarted({ ...parseUrl(request.url), url: request.url, method: request.method, body: request.body })
    reqSet.add(mockId)
    mog('» reqSet is', Array.from(reqSet.get()))

    if (interceptor.response) {
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

    // mocks from storage

    mog(`» trying to get mock with id "${mockId}"`)

    if (await storage.has(mockId)) {
      mog(`» mock "${mockId}" exists!`)

      const mock = await storage.get(mockId)

      loggerTrace(`${request.url} ← mock ${mockId} found in storage`)
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
      loggerTrace(`${request.url} ← mock not found in storage`)
      mog(`» mock does not exist!`, ci)

      if (ci) {
        signale.warn(`mock file not found in ci mode, url is "${request.url}"`)
      } else {
        mog('» about to next()...')
        next(interceptor)
      }
    }
  }
}
