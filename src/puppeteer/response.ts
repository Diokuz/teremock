import debug from 'debug'
import { Request, Response, DrivetResponse } from '../types'

const logger = debug('teremock:puppeteer:response')

export async function extractPuppeteerResponse(puppeteerResponse): Promise<DrivetResponse> {
  const puppeteerRequest = puppeteerResponse.request()

  let requestBody: any
  let responseBody: any

  try {
    responseBody = await puppeteerResponse.json()
  } catch (e) {
    logger('« puppeteerResponse.json() error:', e.message)

    responseBody = await puppeteerResponse.text()
    logger(`« response body starts with: ${responseBody.substr(0, 100)}`)
  }

  try {
    requestBody = JSON.parse(puppeteerRequest.postData())
  } catch (e) {
    requestBody = puppeteerRequest.postData()
  }

  const timestamp = Date.now()

  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: requestBody,
    resourceType: puppeteerRequest.resourceType(),
  }

  const response: Response = {
    url: puppeteerResponse.url(),
    status: puppeteerResponse.status(),
    headers: puppeteerResponse.headers(),
    body: responseBody,
    ttfb: timestamp - puppeteerRequest.timestamp,
    __meta: puppeteerRequest.__meta,
  }

  logger(`got the response, sending it to teremock core`)

  return { request, response }
}
