import debug from 'debug'
import { Request, Response, DriverResponse } from '../types'

const logger = debug('teremock:puppeteer:response')

export async function extractPuppeteerResponse(puppeteerResponse): Promise<DriverResponse> {
  const puppeteerRequest = puppeteerResponse.request()

  let requestBody: string | Record<string, any>
  let responseBody: string | Record<string, any> | undefined

  try {
    responseBody = await puppeteerResponse.json()
  } catch (e) {
    logger('« puppeteerResponse.json() error:', e.message)

    try {
      responseBody = await puppeteerResponse.text()
      logger(`« response body starts with: ${responseBody?.substr(0, 100)}`)
    } catch (e) {
      logger('« puppeteerResponse.text() error:', e.message)
    }
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
  }

  logger(`got the response, sending it to teremock core`)

  return { request, response, __meta: puppeteerRequest.__meta }
}
