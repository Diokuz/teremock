import { debug } from './logger'
import { blacklist, getBody, loggerTrace } from './utils'

import type { Options, Storage, Request, Response, Meta } from './types'

const logger = debug('teremock:response')

type Params = Options & {
  reqSet: Set<string>
  _onReqCompleted: (req: Request, resp: Response) => void
  _onReqsCompleted: () => void
  storage: Storage
}

type Arg = {
  request: Request
  response: Response
  __meta?: Meta
}

export default function createHandler(initialParams: Params) {
  logger('creating response handler')

  return async function handleResponse({ request, response: pResponse, __meta }: Arg, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { storage, reqSet, ci, skipResponseHeaders, skipRequestHeaders, getMockId } = params

    loggerTrace(`${request.url} → handling response`)

    const response = {
      ...pResponse,
      headers: blacklist(pResponse.headers, skipResponseHeaders)
    }

    logger(`» intercepted response with method "${request.method}" and url "${request.url}"`)

    const interceptor = __meta?.interceptor

    if (!interceptor) {
      loggerTrace(`${request.url} → no interceptor found :(`)
      logger(`» interceptor not provided in response object, return`)

      return
    }

    const naming = interceptor.naming ?? {}
    const mockId = getMockId({ ...request, naming, name: interceptor.name, body: getBody(request.body) })
    const mockExist: boolean = await storage.has(mockId)
    const hasResp = !!interceptor.response
    const needMockInResponseFn =
      hasResp && typeof interceptor.response === 'function' && interceptor.response.length === 2
    const mog = debug(`teremock:${mockId}`)

    /**
     * @todo update mock in non-ci mode
     */
    if (ci) {
      loggerTrace(`${request.url} → ci is true, not storing`)
      mog(`« mock was not stored because it is CI mode run`)
    } else if (mockExist) {
      loggerTrace(`${request.url} → mock already exists`)
      mog(`« mock was not stored because it exists`)
    } else if (hasResp && !needMockInResponseFn) {
      loggerTrace(`${request.url} → interceptor.response is defined`)
      mog(`« mock was not stored because matched interceptor have response property`)
    } else if (interceptor.pass) {
      loggerTrace(`${request.url} → interceptor.pass is true, no store`)
      mog(`« mock was not stored because interceptor.pass is true`)
    } else {
      loggerTrace(`${request.url} → storing mock ${mockId}`)
      mog(`« preparing to set a new mock "${mockId}"`)
      const { timestamp: _x, order: _z, id, ...mockRequest } = request
      const { timestamp: _y, order: _k, ...mockResponse } = response

      if (mockRequest.headers) {
        mockRequest.headers = blacklist(mockRequest.headers, skipRequestHeaders)
      }

      await storage.set(mockId, { request: mockRequest, response: mockResponse })
    }

    reqSet.delete(mockId)
    mog('« reqSet after delete is', Array.from(reqSet))

    params._onReqCompleted(request, response)

    if (reqSet.size === 0) {
      mog('« invoking _onReqsCompleted')

      params._onReqsCompleted()
    }
  }
}
