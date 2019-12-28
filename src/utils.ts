import { URL } from 'url'
import debug from 'debug'
import { Capture, Request } from './types'

const logger = debug('teremock:utils')

type InParams = {
  capture: Capture
  request: {
    url: string
    method: string
  }
}

// @todo nanomatch
export const hasMatch = (arr, str) => {
  const lowercasedStr = str.toLowerCase()

  return !!arr.find((el) => {
    return el === '*' || lowercasedStr.includes(el.toLowerCase())
  })
}

// @todo tests
export const isCapturable = ({ capture, request }: InParams) => {
  const isUrlMockable = hasMatch(capture.urls, request.url)
  const isMethodMockable = hasMatch(capture.methods, request.method)

  logger(`checking for capturability, isUrlMockable === ${isUrlMockable}, isMethodMockable === ${isMethodMockable}`)

  return isUrlMockable && isMethodMockable
}

function sameOrigin(url1, url2) {
  const p1 = new URL(url1)
  const p2 = new URL(url2)

  return p1.host === p2.host && p1.protocol === p2.protocol
}

export function isPassable({ pageUrl, reqUrl, method, pass }) {
  const { methods, urls } = pass

  const isSameOrigin = sameOrigin(pageUrl, reqUrl)
  const hasSameOriginPass = urls.find((url) => url === 'same-origin')
  const isMethodPassable = hasMatch(methods, method)
  const isUrlPassable = hasMatch(urls, reqUrl) || (hasSameOriginPass && isSameOrigin)

  return isUrlPassable && isMethodPassable
}

export function getQuery(url) {
  const urlObj = new URL(url)
  urlObj.searchParams.sort()

  const entries = [...urlObj.searchParams]

  return entries.reduce((acc, [key, value]) => {
    acc[key] = value

    return acc
  }, {})
}

export function parseUrl(url) {
  const { origin, pathname } = new URL(url)

  return {
    query: getQuery(url),
    location: origin + pathname,
  }
}

export function isFilterMatched(matchFilter, request: Request) {
  // location have no query params, url has
  const { method, url } = request
  const query = getQuery(url)
  const requestLocation = (url ?? '').split(/[?#]/)[0].toLowerCase()

  logger(`isFilterMatched url`, matchFilter, request)

  const isMatched = Object.keys(matchFilter).reduce((acc, key) => {
    switch (key) {
      case 'method':
        return acc && matchFilter[key].toLowerCase() === method.toLowerCase()
      case 'baseUrl':
        return acc && requestLocation.startsWith(matchFilter[key].toLowerCase())
      case 'url':
        return acc && requestLocation === matchFilter[key].toLowerCase()
      case 'query':
        return (
          acc &&
          Object.keys(matchFilter[key]).reduce((a, k) => {
            return a && matchFilter[key][k] === query[k]
          }, true)
        )
    }
  }, true)

  return isMatched
}

export const isMockMatched = isFilterMatched
export const isSpyMatched = isFilterMatched

export function blacklist(source: Record<string, any>, list: string[]) {
  const set = new Set(list.map(l => l.toLowerCase()))

  return Object.keys(source).reduce((acc, key) => {
    if (!set.has(key.toLowerCase())) {
      acc[key] = source[key]
    }

    return acc
  }, {})
}
