import debug from 'debug'
import { loggerTrace } from '../utils'

import type { Request as PuppeteerRequest } from 'puppeteer'
import type {
  Request,
  Response,
  DriverRequest,
  Interceptor,
  DriverErrorCode,
  ExtractDriverReqResOptions,
} from '../types'

const logger = debug('teremock:driver:puppeteer:request')

let requestsCounter: number = 0

export async function extractPuppeteerRequest(
  puppeteerRequest: PuppeteerRequest,
  options: ExtractDriverReqResOptions
): Promise<DriverRequest> {
  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: puppeteerRequest.postData(),
    resourceType: puppeteerRequest.resourceType(),
    id: requestsCounter++,
    timestamp: options.timestamp,
    order: options.order,
  }

  // @ts-expect-error
  puppeteerRequest.timestamp = options.timestamp
  // @ts-expect-error
  puppeteerRequest.teremockRequest = request
  // @ts-expect-error
  puppeteerRequest.__meta = { request }

  logger(`got the request ${request.url}, sending it to teremock core`)

  return {
    request,
    abort: (errorCode?: DriverErrorCode) => puppeteerRequest.abort(errorCode),
    next: (interceptor: Interceptor) => {
      logger(`continue() call`)
      // @ts-expect-error
      puppeteerRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.continue()`)
      puppeteerRequest.continue()
    },
    respond: (response: Response, interceptor: Interceptor) => {
      logger(`respond() call`)
      // @ts-expect-error
      puppeteerRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.respond(...)`)
      puppeteerRequest.respond(response)
    },
  }
}
