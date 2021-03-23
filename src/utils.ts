import { URL } from 'url'
import debug from 'debug'
import { Request, Response, Options, UserOptions, Interceptor, UserInterceptor } from './types'
import { DEFAULT_INTERCEPTOR_CAPTURE } from './consts'
import { humanize } from './words-hash'
import defaultGetMockId from './mock-id'

const loggerint = debug('teremock:utils:interceptor')
export const loggerTrace = debug('teremock:trace')
let orderCounter = 0

export function assignResponse(response1: Response, response2?: Partial<Response>): Response {
  return {
    ...response1,
    ...response2,
    headers: {
      ...response1.headers,
      ...response2?.headers,
    },
  }
}

type InParams = {
  interceptors: Record<string, Interceptor>
  request: Request
}

export const getHighResTimestamp = () => {
  return {
    time: Date.now(),
    orderMark: ++orderCounter
  }
}

export const isInterceptorMatched = (interceptor: Interceptor, request: Request) => {
  const { url, method, resourceType = 'xhr' } = request

  return Object.keys(interceptor).reduce<boolean>((acc, key) => {
    const value = interceptor[key]

    // Nothing to compare === wildcard (for given `key`)
    if (typeof value === 'undefined' || value === '*' || (value?.has?.('*'))) {
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
      case 'body':
        return acc && isBodyMatched(value, request)
      case 'resourceTypes':
        return acc && value.has(resourceType.toLowerCase())
      default:
        return acc
    }
  }, true)
}

export const findInterceptor = ({ interceptors, request }: InParams): Interceptor | null => {
  const matchedMockKey = Object.keys(interceptors).find((key) => {
    loggerint(`checking key`, key)
    const interceptor = interceptors[key] as Interceptor

    return isInterceptorMatched(interceptor, request)
  })

  loggerint(`found an interceptor`, matchedMockKey)

  return typeof matchedMockKey === 'string' ? interceptors[matchedMockKey] : null
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

export function isBodyMatched(value, request: Request) {
  const { headers } = request
  if (!headers) {
    return false
  }
  let formData = {}
  if (headers['content-type'] === 'application/x-www-form-urlencoded') {
      formData = getFormData(request.body)
  } else if (
    headers['content-type'] === 'application/json'
    && typeof request.body === 'string'
  ) {
    try {
      formData = JSON.parse(request.body)
    } catch (e) {
      return false
    }
  }
  return (Object.keys(value).reduce((a, k) => {
      // won't work with nested objects
      return a && value[k] === formData[k]
  }, true))
}

export function getFormData(body) {
  const params = body.split('&')
  const result = {}
  params.forEach(param => {
    const paramsPart = param.split('=')
    result[decodeURIComponent(paramsPart[0])] = decodeURIComponent(paramsPart[1])
  })
  return result
}

export function parseUrl(url) {
  const { origin, pathname } = new URL(url)

  return {
    query: getQuery(url),
    location: origin + pathname,
  }
}

export function blacklist(source: Record<string, string | string[]> | undefined, list: string[]): Record<string, string | string[]> | undefined {
  if (typeof source === 'undefined') {
    return source
  }

  const set = new Set(list.map(l => l.toLowerCase()))

  return Object.keys(source).reduce((acc, key) => {
    if (!set.has(key.toLowerCase())) {
      acc[key] = source[key]
    }

    return acc
  }, {})
}

export function userInterceptorToInterceptor(uint: UserInterceptor, nameArg?: string): Interceptor {
  const name = uint.name || nameArg || `teremock-add-${humanize(JSON.stringify(uint), 1)}-`
  const validName = name.toLowerCase().replace(/[^a-z0-9_-]+/, '')

  if (name.toLowerCase() !== validName) {
    throw new Error(`invalid interceptor name "${name}"! only letters, digits, - and _ are allowed.`)
  }

  const defaultMethods = DEFAULT_INTERCEPTOR_CAPTURE.methods
  const defaultResourceTypes = DEFAULT_INTERCEPTOR_CAPTURE.resourceTypes
  const methods = typeof uint.methods === 'string' ? new Set(uint.methods.toLowerCase().split(',')) : defaultMethods
  const resourceTypes = typeof uint.resourceTypes === 'string' ? new Set(uint.resourceTypes.toLowerCase().split(',')) : defaultResourceTypes

  let resp = {}

  if ('response' in uint && typeof uint.response !== 'function') {
    resp = {
      response: {
        url: '<unknown>',
        status: 200,
        ...uint.response,
      }
    }
  }

  return {
    ...DEFAULT_INTERCEPTOR_CAPTURE,
    ...uint,
    ...resp,
    methods,
    resourceTypes,
    name: validName,
  }
}

export function userOptionsToOptions(defaultOptions: Options, userOptions: UserOptions): Options {
  const defaultInterceptors = defaultOptions.interceptors
  const { page, ...restUO } = userOptions
  let interceptors = defaultInterceptors

  if (typeof restUO.interceptors !== 'undefined') {
    const userInterceptors: Record<string, UserInterceptor> = restUO.interceptors

    const customInterceptors = Object.keys(userInterceptors).reduce<Record<string, Interceptor>>((acc, key) => {
      acc[key] = userInterceptorToInterceptor(userInterceptors[key], key)

      return acc
    }, {})

    // Default interceptors must be in the end, but it should be possible to overwrite them
    interceptors = { ...customInterceptors, ...defaultInterceptors, ...customInterceptors }
  }

  let getMockId = defaultOptions.getMockId

  if (typeof userOptions.getMockId === 'function') {
    getMockId = (...args): string => {
      // @ts-ignore WHY??
      return userOptions?.getMockId?.(...args) ?? defaultGetMockId(...args)
    }
  }

  return {
    ...defaultOptions,
    ...restUO,
    interceptors,
    getMockId,
  }
}

// https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#requestrespondresponse
export const getBody = (body: Object | string | undefined): string | undefined => {
  if (typeof body === 'string' || typeof body === 'undefined') {
    return body
  }

  return JSON.stringify(body)
}
