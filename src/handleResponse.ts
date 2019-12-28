import debug from 'debug'
import { findInterceptor, blacklist } from './utils'
import getMockId from './mock-id'
import { Options, Storage } from './types'

const logger = debug('teremock:response')

type Params = Options & {
  reqSet: Set<any>
  _onReqsCompleted: Function
  pageUrl: () => string
  storage: Storage
}

export default function createHandler(initialParams) {
  logger('creating response handler')

  return async function handleResponse({ request, response: pResponse }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { interceptors, storage, reqSet, ci, skipResponseHeaders } = params

    const response = {
      ...pResponse,
      headers: blacklist(pResponse.headers, skipResponseHeaders)
    }

    logger(`» intercepted response with method "${request.method}" and url "${request.url}"`)

    const interceptor = findInterceptor({ interceptors, request })

    if (!interceptor) {
      logger(`» interceptor mot found, skipping`)

      return
    }

    const bodyStr: string = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const mockId = getMockId({ ...request, naming: interceptor.hash, name: interceptor.name, body: bodyStr })
    const mockExist: boolean = await storage.has(mockId)

    /**
     * @todo update mock in non-ci mode
     */
    if (!ci && !mockExist && !response.__meta.interceptor.response) {
      logger(`» preparing to set a new mock "${mockId}"`)
      const { __meta, ...data } = response
      await storage.set(mockId, { request, response: data })
    }

    reqSet.delete(mockId)
    debug('teremock:connections:delete')(mockId, Array.from(reqSet))

    if (reqSet.size === 0) {
      logger('« invoking _onReqsCompleted')

      params._onReqsCompleted()
    }
  }
}
