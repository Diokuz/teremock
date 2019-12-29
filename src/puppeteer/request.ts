import debug from 'debug'
import { Request, Response, DrivetRequest, Interceptor } from '../types'

const logger = debug('teremock:puppeteer:request')

export async function extractPuppeteerRequest(puppeteerRequest): Promise<DrivetRequest> {
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

  logger(`got the request, sending it to teremock core`)

  return {
    request,
    abort: (...args) => puppeteerRequest.abort(...args),
    next: (interceptor: Interceptor) => {
      puppeteerRequest.__meta.interceptor = interceptor
      puppeteerRequest.continue()
    },
    respond: (response: Response, interceptor: Interceptor) => {
      puppeteerRequest.__meta.interceptor = interceptor
      puppeteerRequest.respond(response)
    },
  }
}
