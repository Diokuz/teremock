import debug from 'debug'
import signale from '../logger'

import type { Response as PuppeteerResponse } from 'puppeteer'
import type { Request, Response, DriverResponse, Meta, ExtractDriverReqResOptions } from '../types'

const logger = debug('teremock:driver:puppeteer:response')

export async function extractPuppeteerResponse(
  puppeteerResponse: PuppeteerResponse,
  options: ExtractDriverReqResOptions
): Promise<DriverResponse> {
  const puppeteerRequest = puppeteerResponse.request()

  let requestBody: any
  let responseBody: any

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

  requestBody = puppeteerRequest.postData()
  if (requestBody) {
    try {
      requestBody = JSON.parse(requestBody)
    } catch (e) {}
  }

  const { teremockRequest } = (puppeteerRequest as unknown) as { teremockRequest: Request }

  const request: Request = {
    url: puppeteerRequest.url(),
    method: puppeteerRequest.method(),
    headers: puppeteerRequest.headers(),
    body: requestBody,
    resourceType: puppeteerRequest.resourceType(),
    id: teremockRequest ? teremockRequest.id : -1,
    timestamp: teremockRequest ? teremockRequest.timestamp : 0,
    order: teremockRequest ? teremockRequest.order : -1,
  }

  const response: Response = {
    url: puppeteerResponse.url(),
    status: puppeteerResponse.status(),
    headers: puppeteerResponse.headers(),
    body: responseBody,
    timestamp: options.timestamp,
    order: options.order,
    // ttfb: timestamp - puppeteerRequest.timestamp,
  }

  logger(`got the response, sending it to teremock core`)

  const { __meta } = (puppeteerRequest as unknown) as { __meta?: Meta }

  if (!__meta) {
    signale.warn(`__meta was not found in puppeteerRequest. Probably it was made before teremock.start()`)
    signale.warn(`Passing the response witout storing it. The request was:`, request)
  }

  return { request, response, __meta }
}
