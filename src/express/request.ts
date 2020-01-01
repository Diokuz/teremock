import debug from 'debug'
import { Request, Response, DriverRequest, Interceptor } from '../types'
import { ExtractedResponse } from './response'

const logger = debug('teremock:puppeteer:request')

type Ret = DriverRequest & {
  onRespondPromise: Promise<RespondResolve>
}

type GetRealResponse = (r: Request) => Promise<ExtractedResponse>

type RealResponseResolve = {
  realResponse: ExtractedResponse
  interceptor: Interceptor
}
type MockedResponseResolve = {
  response: Response
  interceptor: Interceptor
}
type RespondResolve = RealResponseResolve | MockedResponseResolve

export async function extractExpressRequest(req, res, realUrl: string, getRealResponse: GetRealResponse): Promise<Ret> {
  const request: Request = {
    url: realUrl,
    method: req.method,
    // @ts-ignore
    headers: req.headers,
    body: req.body,
    resourceType: 'xhr',
  }

  let resolve: (arg: RespondResolve) => void
  let reject

  const onRespondPromise = new Promise<RespondResolve>((r, rej) => {
    resolve = r
    reject = rej
  })

  const abort = () => {
    res.status(503).end()
    reject(new Error(`abort()`))
  }
  const next = async (interceptor: Interceptor): Promise<void> => {
    // goto real backend
    const realResponse = await getRealResponse(request)
    const realResp: RealResponseResolve = { realResponse, interceptor }

    resolve(realResp)
  }
  const respond = (resp: Response, interceptor: Interceptor) => {
    const mockedResp: MockedResponseResolve = { response: resp, interceptor }

    resolve(mockedResp)
  }

  // req.timestamp = Date.now()
  // req.teremockRequest = request
  // req.__meta = { request }

  logger(`got the request, sending it to teremock core`)

  return { request, abort, respond, next, onRespondPromise }
}
