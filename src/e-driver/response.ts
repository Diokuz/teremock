// import debug from 'debug'
// const logger = debug('teremock:puppeteer:response')
import type { Headers } from '../types'

export interface GotResponse {
  body: string
  url: string
  statusCode: number
  headers?: Record<string, string | string[] | undefined>
}

export interface ExtractedResponse {
  url: string
  headers?: Headers
  status: number
  body: string
}

const ALLOWED_HEADERS = new Set(['content-type'])

export function extractGotResponse(gotResponse: GotResponse): ExtractedResponse {
  let requestBody = gotResponse.body

  try {
    requestBody = JSON.parse(gotResponse.body)
  } catch (e) {
    // pass
  }

  const filteredHeaders: Record<string, string> = Object.keys(gotResponse.headers || {}).reduce((acc, key) => {
    if (gotResponse.headers?.[key] !== undefined && ALLOWED_HEADERS.has(key.toLowerCase())) {
      // see https://tools.ietf.org/html/rfc2616#section-4.2 we can join array to comma-separated string
      acc[key] = Array.isArray(gotResponse.headers[key])
        ? (gotResponse.headers![key]! as string[]).join(',')
        : (gotResponse.headers![key]! as string)
    }

    return acc
  }, {} as Record<string, string>)

  return {
    url: gotResponse.url,
    headers: filteredHeaders,
    status: gotResponse.statusCode,
    body: requestBody,
  }
}
