import { debug } from './logger'
import { blacklist, getBody } from './utils'
import { Options, Storage, Request, Response, Meta } from './types'

const logger = debug('teremock:response')

type Params = Options & {
  reqSet: Set<string>
  _onReqsCompleted: Function
  storage: Storage
}

type Arg = {
  request: Request
  response: Response
  __meta?: Meta
}

export default function createHandler(initialParams) {
  logger('creating response handler')

  return async function handleResponse({ request, response: pResponse, __meta }: Arg, extraParams = {}) {
    const params: Params = { ...initialParams, ...extraParams }
    const { storage, reqSet, ci, skipResponseHeaders, getMockId } = params

    const response = {
      ...pResponse,
      headers: blacklist(pResponse.headers, skipResponseHeaders)
    }

    logger(`» intercepted response with method "${request.method}" and url "${request.url}"`)

    const interceptor = __meta?.interceptor

    if (!interceptor) {
      logger(`» interceptor not provided in response object, return`)

      return
    }

    const naming = interceptor.naming ?? {}
    const mockId = getMockId({ ...request, naming, name: interceptor.name, body: getBody(request.body) })
    const mockExist: boolean = await storage.has(mockId)
    const hasResp = !!interceptor.response
    const isPassable = interceptor.pass
    const mog = debug(`teremock:${mockId}`)

    /**
     * @todo update mock in non-ci mode
     */
    if (!ci && !mockExist && !hasResp && !isPassable) {
      mog(`« preparing to set a new mock "${mockId}"`)
      await storage.set(mockId, { request, response })
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
