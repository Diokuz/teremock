import path from 'path'
import isCi from 'is-ci'
import getMockId from './mock-id'

import type { Options, Interceptor } from './types'

export const DEFAULT_INTERCEPTOR_CAPTURE = {
  name: '__teremock_buildin_capture',
  url: '*',
  methods: new Set('*'),
  pass: false,
  naming: {},
  resourceTypes: new Set(['xhr', 'fetch']),
}

export const DEFAULT_INTERCEPTOR_PASS = {
  name: '__teremock_buildin_pass',
  url: '*',
  methods: new Set('*'),
  pass: true,
  naming: {},
  resourceTypes: new Set('*'),
}

const defaultInterceptors: Record<string, Interceptor> = {
  // You could overwrite default interceptors, but do you really need that? Tell me in issue!
  __teremock_buildin_capture: DEFAULT_INTERCEPTOR_CAPTURE,
  __teremock_buildin_pass: DEFAULT_INTERCEPTOR_PASS,
}

export const DEFAULT_OPTIONS: Options = {
  interceptors: defaultInterceptors,
  skipResponseHeaders: [
    'date',
    'expires',
    'last-modified',
    'x-powered-by',
    'etag',
    'cache-control',
    'content-length',
    'server',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
  ],
  skipRequestHeaders: [
    'user-agent',
  ],
  // https://github.com/facebook/jest/blob/c6512ad1b32a5d22aab9937300aa61aa87f76a27/packages/jest-cli/src/cli/args.js#L128
  ci: isCi, // Same behaviour as in Jest
  awaitConnectionsOnStop: false,
  getMockId,
  // You need default value, or next teremock.start() (without options.wd) will use old wd value
  wd: path.resolve(process.cwd(), '__teremocks__'),
}

export const DEFAULT_RESP_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
}
