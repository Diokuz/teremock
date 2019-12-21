import { URL } from 'url'
import debug from 'debug'
import { Capture } from './types'

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

export function isSpyMatched(spyFilter, request) {
  const { query, method, location } = request

  return Object.keys(spyFilter).reduce((acc, key) => {
    switch (key) {
      case 'method':
        return acc && spyFilter[key] === method
      case 'location':
        return acc && location.startsWith(spyFilter[key])
      case 'query':
        return (
          acc &&
          Object.keys(spyFilter[key]).reduce((a, k) => {
            return a && spyFilter[key][k] === query[k]
          }, true)
        )
    }
  }, true)
}
