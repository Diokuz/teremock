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
      logger(`» mock mot found, skipping`)

      return
    }

    const bodyStr: string = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const mockId = getMockId({ ...request, naming: interceptor.hash, name: interceptor.name, body: bodyStr })
    const mockExist: boolean = await storage.has(mockId)

    /**
     * @attention here!
     * Existing mocks will not be overwritten.
     * To update mocks, remove them first.
     * Otherwise it would create files for manual (e.g. mocker.set('response', ...)) mocks
     */
    if (!ci && !mockExist) {
      logger(`» preparing to set a new mock "${mockId}"`)
      // @ts-ignore
      await storage.set(mockId, { request, response })
    }

    reqSet.delete(mockId)
    debug('teremock:connections:delete')(mockId, Array.from(reqSet))

    if (reqSet.size === 0) {
      logger('« invoking _onReqsCompleted')

      params._onReqsCompleted()
    }
  }
}
