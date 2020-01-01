// import debug from 'debug'
// const logger = debug('teremock:puppeteer:response')

type GotResponse = {
  body: string
  url: string
  statusCode: number
  headers: any // Record<string, string>
}

export type ExtractedResponse = {
  url: string
  headers: Record<string, string>
  status: number
  body: string
}

export function extractGotResponse(gotResponse: GotResponse): ExtractedResponse {
  let requestBody = gotResponse.body

  try {
    requestBody = JSON.parse(gotResponse.body)
  } catch (e) {
    // pass
  }

  return {
    url: gotResponse.url,
    headers: gotResponse.headers,
    status: gotResponse.statusCode,
    body: requestBody,
  }
}
