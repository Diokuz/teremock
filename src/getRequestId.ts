// @ts-ignore
import { createHash } from 'crypto'
// @ts-ignore
import { URL } from 'url'
// @ts-ignore
import queryString from 'query-string'
import { humanize } from './words-hash'
import { Naming } from './types'

type Params = {
  url: string
  method?: string
  headers?: Record<string, string>
  postData?: string
  naming?: Naming
  verbose?: boolean
}

/**
 * Request Id generator.
 * Accounts for request data:
 * 1. url (protocol + host + path)
 * 2. query params (filtered with naming.query)
 * 3. method (get, post...) (as prefix)
 * 4. postData, if any (filtered with naming.body)
 *
 * Rid does not accounts for
 * 1. Any response data, including status, body and headers
 * 2. request headers (do you need that?)
 *
 * Order agnostic, so, `/foo=bar&baz=1` will have the same rid as `/baz=1&foo=bar`
 */
const getRequestId = (params: Params) => {
  let url = params.url
  let method = params.method || 'GET'
  let headers = params.headers
  let postData = params.postData || ''
  let queryWhitelist = params.naming?.query?.whitelist || []
  let bodyBlacklist = params.naming?.body?.blacklist || []
  let queryBlacklist = params.naming?.query?.blacklist || []

  const urlObj = new URL(url)
  let postObj

  urlObj.searchParams.sort()

  // @todo remove it from here, rename postData to body
  if (postData !== '' && headers) {
    switch (headers['content-type']) {
      case 'application/json':
        postObj = JSON.parse(postData)
        break
      default:
        postObj = queryString.parse(postData)
        break
    }
  }

  if (params.verbose) {
    console.log('requestId: postObj', postObj)
  }

  if (postObj) {
    bodyBlacklist.forEach((param: string | string[]) => {
      let currentObj = postObj
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

    postData = JSON.stringify(postObj)
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
  let baseStr = urlObj.toString() + postData

  if (params.verbose) {
    console.log('requestId: baseStr, baseStr.length', baseStr, baseStr.length)
  }

  return `${method.toLowerCase()}-${humanize(baseStr, 3)}`
}

export default getRequestId
