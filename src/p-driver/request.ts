import debug from 'debug'
import { Request, Response, DriverRequest, Interceptor } from '../types'
import { loggerTrace } from '../utils'

const logger = debug('teremock:driver:puppeteer:request')

export async function extractPuppeteerRequest(puppeteerRequest): Promise<DriverRequest> {
  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: puppeteerRequest.postData(),
    resourceType: puppeteerRequest.resourceType(),
  }

  puppeteerRequest.timestamp = Date.now()
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
