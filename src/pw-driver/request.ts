import debug from 'debug'
import { loggerTrace } from '../utils'

import type { Route } from 'playwright'
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

export function extractPlaywrightRequest(route: Route, options: ExtractDriverReqResOptions): DriverRequest {
  const playwrightRequest = route.request()
  const request: Request = {
    url: playwrightRequest.url(),
    method: playwrightRequest.method(),
    headers: playwrightRequest.headers(),
    body: playwrightRequest.postData(),
    resourceType: playwrightRequest.resourceType(),
    id: requestsCounter++,
    timestamp: options.timestamp,
    order: options.order,
  }

  // @ts-expect-error
  playwrightRequest.timestamp = options.timestamp
  // @ts-expect-error
  playwrightRequest.teremockRequest = request
  // @ts-expect-error
  playwrightRequest.__meta = { request }

  logger(`got the request ${request.url}, sending it to teremock core`)

  return {
    request,
    abort: (errorCode?: DriverErrorCode) => route.abort(errorCode),
    next: (interceptor: Interceptor) => {
      logger(`continue() call`)
      // @ts-expect-error
      playwrightRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.continue()`)
      route.continue()
    },
    respond: (response: Response, interceptor: Interceptor) => {
      logger(`respond() call`)
      // @ts-expect-error
      playwrightRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.respond(...)`)

      route.fulfill(response)
    },
  }
}
