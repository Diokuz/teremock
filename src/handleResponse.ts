import debug from 'debug'
import { isCapturable, blacklist } from './utils'
import getMockId from './mock-id'
import { Options } from './types'

const logger = debug('teremock:response')

type Params = Options & {
  reqSet: Set<any>
  _onReqsCompleted: Function
  pageUrl: () => string
}

export default function createHandler(initialParams) {
  logger('creating response handler')

  return async function handleResponse({ request, response: pResponse }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { storage, reqSet, capture, naming, ci, skipResponseHeaders } = params

    const response = {
      ...pResponse,
      headers: blacklist(pResponse.headers, skipResponseHeaders)
    }

    logger(`» intercepted response with method "${request.method}" and url "${request.url}"`)

    const dontIntercept = !isCapturable({ capture, request })

    if (dontIntercept) {
      logger(`» dontIntercept "${dontIntercept}". Skipping.`)

      return
    }

    const bodyStr: string = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const mockId = getMockId({ ...request, naming, body: bodyStr })
    const mockExist: boolean = await storage.has(mockId, { wd: params.wd })

    /**
     * @attention here!
     * Existing mocks will not be overwritten.
     * To update mocks, remove them first.
     * Otherwise it would create files for manual (e.g. mocker.set('response', ...)) mocks
     */
    if (!ci && !mockExist) {
      logger(`» preparing to set a new mock "${mockId}"`)
      await storage.set(mockId, { request, response }, { wd: params.wd })
    }

    reqSet.delete(mockId)
    debug('teremock:connections:delete')(mockId, Array.from(reqSet))

    if (reqSet.size === 0) {
      logger('« invoking _onReqsCompleted')

      params._onReqsCompleted()
    }
  }
}
