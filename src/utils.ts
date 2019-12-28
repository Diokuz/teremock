import { URL } from 'url'
import debug from 'debug'
import { Request, Options, UserOptions, Interceptor, UserInterceptor } from './types'
import { DEFAULT_INTERCEPTOR } from './consts'

const logger = debug('teremock:utils')
const loggerint = debug('teremock:utils:interceptor')

type InParams = {
  interceptors: Record<string, Interceptor>
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
export const findInterceptor = ({ interceptors, request }: InParams): Interceptor | null => {
  const { url, method } = request
  loggerint(`entering findInterceptor with args`, interceptors, request)

  const matchedMockKey = Object.keys(interceptors).reverse().find((key) => {
    loggerint(`checking key`, key)
    const interceptor = interceptors[key] as Interceptor

    return Object.keys(interceptor).reduce<boolean>((acc, key) => {
      const value = interceptor[key]

      // Nothing to compare === wildcard (for given `key`)
      if (typeof value === 'undefined' || value === '*') {
        return acc
      }

      switch (key) {
        case 'url':
          return acc && url.includes(value)
        case 'methods':
          return acc && value.has(method.toLowerCase())
        case 'query':
          const query = getQuery(url)

          return (
            acc &&
            Object.keys(value).reduce((a, k) => {
              return a && value[k] === query[k]
            }, true)
          )
        default:
          return acc
      }
    }, true)
  })

  loggerint(`found an interceptor`, matchedMockKey)

  return typeof matchedMockKey === 'string' ? interceptors[matchedMockKey] : null
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

// duplicates are not supported
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

// function isResponse(maybeResponse: Response | Object | void): maybeResponse is Response {
//   return !!maybeResponse && 'body' in maybeResponse
// }

export function userInterceptorToInterceptor(userInterceptor: UserInterceptor, nameArg: string): Interceptor {
  const name = userInterceptor.name || nameArg
  const validName = name.replace(/[^a-z0-9_-]+/, '')

  if (name !== validName) {
    throw new Error(`invalid mocks name "${name}"! only letters, digits, - and _ are allowed.`)
  }

  const defaultMethods = DEFAULT_INTERCEPTOR.methods
  const methods = typeof userInterceptor.methods === 'string' ? new Set(userInterceptor.methods.split(',')) : defaultMethods

  return {
    ...DEFAULT_INTERCEPTOR,
    ...userInterceptor,
    methods,
    name,
  }
}

export function userOptionsToOptions(defaultOptions: Options, userOptions: UserOptions): Options {
  const defaultInterceptors = defaultOptions.interceptors
  const { page, ...restUO } = userOptions
  let interceptors = defaultInterceptors

  if (typeof restUO.interceptors !== 'undefined') {
    const userInterceptors: Record<string, UserInterceptor> = restUO.interceptors

    interceptors = Object.keys(userInterceptors).reduce<Record<string, Interceptor>>((acc, key) => {
      acc[key] = userInterceptorToInterceptor(userInterceptors[key], key)

      return acc
    }, {})
  }

  return {
    ...defaultOptions,
    ...restUO,
    interceptors,
  }
}
