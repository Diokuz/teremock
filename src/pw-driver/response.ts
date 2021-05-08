import debug from 'debug'
import signale from '../logger'

import type { Response as PlaywrightResponse } from 'playwright'
import type { Request, Response, DriverResponse, Meta, ExtractDriverReqResOptions } from '../types'

const logger = debug('teremock:driver:puppeteer:response')

export async function extractPlaywrightResponse(
  playwrightResponse: PlaywrightResponse,
  options: ExtractDriverReqResOptions
): Promise<DriverResponse> {
  const playwrightRequest = playwrightResponse.request()

  let requestBody: string | Record<string, any> | null
  let responseBody: string | Record<string, any> | undefined

  try {
    responseBody = await playwrightResponse.json()
  } catch (e) {
    logger('« playwrightResponse.json() error:', e.message)

    try {
      responseBody = await playwrightResponse.text()
      logger(`« response body starts with: ${responseBody?.substr(0, 20)}`)
    } catch (e) {
      logger('« playwrightResponse.text() error:', e.message)
    }
  }

  try {
    requestBody = JSON.parse(playwrightRequest.postData() as string)
  } catch (e) {
    requestBody = playwrightRequest.postData()
  }

  // @ts-expect-error
  const { teremockRequest } = playwrightRequest

  const request: Request = {
    url: playwrightRequest.url(),
    method: playwrightRequest.method(),
    headers: playwrightRequest.headers(),
    body: requestBody,
    resourceType: playwrightRequest.resourceType(),
    id: teremockRequest ? teremockRequest.id : -1,
    timestamp: teremockRequest ? teremockRequest.timestamp : 0,
    order: teremockRequest ? teremockRequest.order : -1,
  }

  const response: Response = {
    url: playwrightResponse.url(),
    status: playwrightResponse.status(),
    headers: playwrightResponse.headers(),
    body: responseBody,
    timestamp: options.timestamp,
    order: options.order,
    // ttfb: timestamp - playwrightRequest.timestamp,
  }

  logger(`got the response, sending it to teremock core`)

  const { __meta } = (playwrightRequest as unknown) as { __meta?: Meta }

  if (!__meta) {
    signale.warn(`__meta was not found in playwrightRequest. Probably it was made before teremock.start()`)
    signale.warn(`Passing the response witout storing it. The request was:`, request)
  }

  return { request, response, __meta }
}
