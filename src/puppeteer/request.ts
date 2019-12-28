import debug from 'debug'
import { Request, DrivetRequest } from '../types'

const logger = debug('teremock:puppeteer:request')

export async function extractPuppeteerRequest(puppeteerRequest): Promise<DrivetRequest> {
  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: puppeteerRequest.postData(),
  }

  puppeteerRequest.timestamp = Date.now()

  logger(`got the request, sending it to teremock core`)

  return {
    request,
    abort: (...args) => puppeteerRequest.abort(...args),
    next: (...args) => puppeteerRequest.continue(...args),
    respond: (...args) => puppeteerRequest.respond(...args),
  }
}
