import { debug } from './logger'
import { blacklist } from './utils'
import getMockId from './mock-id'
import { Options, Storage } from './types'

const logger = debug('teremock:response')

type Params = Options & {
  reqSet: Set<string>
  _onReqsCompleted: Function
  storage: Storage
}

export default function createHandler(initialParams) {
  logger('creating response handler')

  return async function handleResponse({ request, response: pResponse }, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { storage, reqSet, ci, skipResponseHeaders } = params

    const response = {
      ...pResponse,
      headers: blacklist(pResponse.headers, skipResponseHeaders)
    }

    logger(`» intercepted response with method "${request.method}" and url "${request.url}"`)

    const interceptor = response.__meta.interceptor

    if (!interceptor) {
      logger(`» interceptor not provided in response object, return`)

      return
    }

    const bodyStr: string = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const mockId = getMockId({ ...request, naming: interceptor.hash, name: interceptor.name, body: bodyStr })
    const mockExist: boolean = await storage.has(mockId)
    const hasResp = !!interceptor.response
    const isPassable = interceptor.pass
    const mog = debug(`teremock:${mockId}`)

    /**
     * @todo update mock in non-ci mode
     */
    if (!ci && !mockExist && !hasResp && !isPassable) {
      mog(`« preparing to set a new mock "${mockId}"`)
      const { __meta, ...data } = response
      await storage.set(mockId, { request, response: data })
    } else {
      mog(`« mock was not stored, because of any true values:`)
      mog(`« mockExist is "${mockExist}", !!interceptor.response is "${hasResp}", interceptor.pass is "${isPassable}"`)
    }

    reqSet.delete(mockId)
    mog('« reqSet after delete is', Array.from(reqSet))

    if (reqSet.size === 0) {
      mog('« invoking _onReqsCompleted')

      params._onReqsCompleted()
    }
  }
}
