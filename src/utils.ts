import { URL } from 'url'
import debug from 'debug'
import isMatch from 'lodash.ismatch'

import { DEFAULT_INTERCEPTOR_CAPTURE } from './consts'
import { humanize } from './words-hash'
import defaultGetMockId from './mock-id'

import type { Request, Response, Options, UserOptions, Interceptor, UserInterceptor } from './types'

const loggerint = debug('teremock:utils:interceptor')
const loggerBody = debug('teremock:utils:bodymatched')
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

export interface InParams {
  interceptors: Record<string, Interceptor>
  request: Request
}

export interface TimeStampWithStrictOrder {
  timestamp: number
  order: number
}

export const getTimeStampWithStrictOrder = (): TimeStampWithStrictOrder => {
  return {
    timestamp: Date.now(),
    order: ++orderCounter,
  }
}

export const isInterceptorMatched = (interceptor: Interceptor, request: Request) => {
  const { url, method, resourceType = 'xhr' } = request

  return (Object.keys(interceptor) as Array<keyof Interceptor>).reduce<boolean>((acc, key) => {
    const value = interceptor[key]

    // Nothing to compare === wildcard (for given `key`)
    if (typeof value === 'undefined' || value === '*' || ((value && value instanceof Set) && value.has('*'))) {
      return acc
    }

    switch (key) {
      case 'url':
        return acc && url.includes(value as string)
      case 'methods':
        return acc && (value as Set<string>).has(method.toLowerCase())
      case 'query':
        const query = getQuery(url)

        return (
          acc &&
          Object.keys(value as Record<string, any>).reduce((a, k) => {
            return a && (value as Record<string, any>)[k] === query[k]
          }, true as boolean)
        )
      case 'body':
        return acc && isBodyMatched(value, request)
      case 'resourceTypes':
        return acc && (value as Set<string>).has(resourceType.toLowerCase())
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
export function getQuery(url: string): Record<string, string> {
  const urlObj = new URL(url)
  urlObj.searchParams.sort()

  const entries = [...urlObj.searchParams]

  return entries.reduce((acc, [key, value]) => {
    acc[key] = value

    return acc
  }, {} as Record<string, string>)
}

export function isBodyMatched(value: any, request: Request) {
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

  // If body in UserInterceptor is empty - is considered equal
  if (!Object.keys(value).length) {
    return true
  }

  const objectsIsMatch = isMatch(formData, value)

  if (!objectsIsMatch) {
    loggerBody('Body not matched. Request body: ', formData)
  }

  return objectsIsMatch
}

// problem with decoding string, where spaces are encoded as "+" - it is correct for specification
// x-www-form-urlencoded content type https://www.rfc-editor.org/rfc/rfc1866,
// but JS decodeUri function doesn't decode it. same function exist in third-party libraries:
// https://chromium.googlesource.com/chromium/src.git/+/62.0.3178.1/third_party/google_input_tools/third_party/closure_library/closure/goog/string/string.js?autodive=0%2F%2F%2F%2F#486
function decodeUriWithSpaces (encodedStr: string) {
  return decodeURIComponent(encodedStr.replace(/\+/g, ' '))
}

export function getFormData(body: Request['body']): Record<string, string> {
  const result: Record<string, string> = {}
  if (typeof body === 'string') {
    const params = body.split('&')
    params.forEach(param => {
      const paramsPart = param.split('=')
      result[decodeUriWithSpaces(paramsPart[0])] = decodeUriWithSpaces(paramsPart[1])
    })
  }

  return result
}

export interface ParsedUrl {
  query: Record<string, string>,
  location: string,
}

export function parseUrl(url: string): ParsedUrl {
  const { origin, pathname } = new URL(url)

  return {
    query: getQuery(url),
    location: origin + pathname,
  }
}

export function blacklist(source: Response['headers'] | undefined, list: string[]): Response['headers'] | undefined {
  if (typeof source === 'undefined') {
    return source
  }

  const set = new Set(list.map(l => l.toLowerCase()))

  return Object.keys(source).reduce((acc, key) => {
    if (!set.has(key.toLowerCase())) {
      acc[key] = source[key]
    }

    return acc
  }, {} as Required<Response>['headers'])
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
      },
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
export const getBody = (body: Object | string | undefined | null): string | undefined => {
  if (typeof body === 'string' || typeof body === 'undefined') {
    return body
  }

  return JSON.stringify(body)
}

export class AsyncPendingQueue {
  protected allSettledPromise: Promise<unknown> = Promise.resolve()
  protected _errorsCount = 0

  add<T>(promise: Promise<T>): Promise<T> {
    const catchedPromise = promise.catch(() => {
      this._errorsCount += 1
    })

    this.allSettledPromise = Promise.all([this.allSettledPromise, catchedPromise]).then(() => null)

    return promise
  }

  async awaitPending(): Promise<number> {
    await this.allSettledPromise
    return this._errorsCount
  }
}
