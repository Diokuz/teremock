// import debug from 'debug'
// const logger = debug('teremock:puppeteer:response')
import { Headers } from '../types'

type GotResponse = {
  body: string
  url: string
  statusCode: number
  headers?: Record<string, string | string[] | undefined>
}

export type ExtractedResponse = {
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

  const filteredHeaders: Record<string, string | string[]> = Object.keys(gotResponse.headers || {}).reduce(
    (acc, key) => {
      if (typeof gotResponse.headers?.[key] !== 'undefined' && ALLOWED_HEADERS.has(key.toLowerCase())) {
        acc[key] = gotResponse.headers[key]
      }

      return acc
    },
    {}
  )

  return {
    url: gotResponse.url,
    headers: filteredHeaders,
    status: gotResponse.statusCode,
    body: requestBody,
  }
}
