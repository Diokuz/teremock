import debug from 'debug'
import { Request, Response, DriverResponse } from '../types'
import signale from '../logger'

const logger = debug('teremock:driver:puppeteer:response')

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
      logger(`« response body starts with: ${responseBody?.substr(0, 20)}`)
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
  const { teremockRequest } =  puppeteerRequest

  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: requestBody,
    resourceType: puppeteerRequest.resourceType(),
    id: teremockRequest ? teremockRequest.id : -1,
    timestamp: teremockRequest ? teremockRequest.timestamp : 0
  }

  const response: Response = {
    url: puppeteerResponse.url(),
    status: puppeteerResponse.status(),
    headers: puppeteerResponse.headers(),
    body: responseBody,
    requestId: teremockRequest ? teremockRequest.id : -1,
    timestamp
    // ttfb: timestamp - puppeteerRequest.timestamp,
  }

  logger(`got the response, sending it to teremock core`)

  if (!puppeteerRequest.__meta) {
    signale.warn(`__meta was not found in puppeteerRequest. Probably it was made before teremock.start()`)
    signale.warn(`Passing the response witout storing it. The request was:`, request)
  }

  return { request, response, __meta: puppeteerRequest.__meta }
}
