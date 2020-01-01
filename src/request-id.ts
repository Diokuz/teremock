// @ts-ignore
import { createHash } from 'crypto'
// @ts-ignore
import { URL } from 'url'
// @ts-ignore
import queryString from 'query-string'
import { humanize } from './words-hash'
import { Naming, Headers } from './types'

// Length of query string after which three-words-naming is switching on
const MAX_QUERY_NAME_LENGTH = 25

type Params = {
  url: string
  method?: string
  headers?: Headers
  body?: string
  naming: Naming
}

/**
 * Request Id generator.
 * Accounts for request data:
 * 1. url (protocol + host + path)
 * 2. query params (filtered with naming.query)
 * 3. method (get, post...) (as prefix)
 * 4. body, if any (filtered with naming.body)
 *
 * getRequestId does not accounts for
 * 1. blacklisted query and body params
 * 2. Any response data, including status, body and headers
 * 3. request headers (do you need that?)
 * 4. cookies
 *
 * Order agnostic, so, `/foo=bar&baz=1` will have the same rid as `/baz=1&foo=bar`
 */
const getRequestId = (params: Params) => {
  let url = params.url
  let method = (params.method || 'GET').toLowerCase()
  let headers = params.headers
  let body = params.body || ''
  let queryWhitelist = params.naming.query?.whitelist || []
  let bodyBlacklist = params.naming.body?.blacklist || []
  let queryBlacklist = params.naming.query?.blacklist || []

  const urlObj = new URL(url)
  let bodyObj

  urlObj.searchParams.sort()

  // @todo remove it from here, rename body to body
  if (body !== '' && headers) {
    switch (headers['content-type']) {
      case 'application/json':
        bodyObj = JSON.parse(body)
        break
      default:
        bodyObj = queryString.parse(body)
        break
    }
  }

  if (bodyObj) {
    bodyBlacklist.forEach((param: string | string[]) => {
      let currentObj = bodyObj
      let paramForDelete = param

      if (Array.isArray(paramForDelete)) {
        const path: string[] = [...param]

        while (path.length > 1) {
          // @ts-ignore
          currentObj = currentObj[path.shift()]

          if (!currentObj) {
            return
          }
        }

        paramForDelete = path.shift() as string
      }

      delete currentObj[paramForDelete]
    })

    body = JSON.stringify(bodyObj)
  }

  /**
   * If naming.query.whitelist is set, removes any searchParams from the url,
   * which are not declared in the whitelist array
   */
  if (queryWhitelist.length > 0) {
    // @ts-ignore
    let keys = [...urlObj.searchParams.keys()]
    for (let key of keys) {
      if (!queryWhitelist.includes(key)) {
        urlObj.searchParams.delete(key)
      }
    }
  }

  // Some parameters could vary over the time, so we can exclude them from naming
  // (be carefull, use it only if it does not affect actual response body)
  // @ts-ignore
  queryBlacklist.forEach((param) => urlObj.searchParams.delete(param))
  let baseStr = urlObj.toString() + body

  const entries = [...urlObj.searchParams]

  const queryStr: string = entries.reduce((acc: string[], [key, value]) => {
    acc.push(`${key}-${value}`)

    return acc
  }, []).join('-')

  let queryStrAscii = queryStr.toLowerCase().replace(/[^a-z0-9-]/g, '')

  if (method === 'get' && !queryStr.length) {
    return method
  }

  if (method === 'get' && queryStr.length < MAX_QUERY_NAME_LENGTH && queryStr.length === queryStrAscii.length) {
    return `${method}-${queryStrAscii}`
  }

  return `${method}-${humanize(baseStr, 3)}`
}

export default getRequestId
