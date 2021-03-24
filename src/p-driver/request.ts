import debug from 'debug'
import { Request, Response, DriverRequest, Interceptor } from '../types'
import { loggerTrace } from '../utils'

const logger = debug('teremock:driver:puppeteer:request')

let requestsCounter: number = 0

export async function extractPuppeteerRequest(puppeteerRequest, options): Promise<DriverRequest> {
  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: puppeteerRequest.postData(),
    resourceType: puppeteerRequest.resourceType(),
    id: requestsCounter++,
    timestamp: options.timestamp,
    order: options.order
  }

  puppeteerRequest.timestamp = options.timestamp
  puppeteerRequest.teremockRequest = request
  puppeteerRequest.__meta = { request }

  logger(`got the request ${request.url}, sending it to teremock core`)

  return {
    request,
    abort: (...args) => puppeteerRequest.abort(...args),
    next: (interceptor: Interceptor) => {
      logger(`continue() call`)
      puppeteerRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.continue()`)
      puppeteerRequest.continue()
    },
    respond: (response: Response, interceptor: Interceptor) => {
      logger(`respond() call`)
      puppeteerRequest.__meta.interceptor = interceptor
      loggerTrace(`${request.url} ← request.respond(...)`)
      puppeteerRequest.respond(response)
    },
  }
}
