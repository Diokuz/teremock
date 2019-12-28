import isCi from 'is-ci'
import { Options, Interceptor } from './types'

export const DEFAULT_INTERCEPTOR = {
  // @todo headers: { only application/json by default }
  url: '*',
  methods: new Set('get,post,put,patch,delete,option,head'.split(',')),
  pass: false,
  hash: {},
}

const defaultInterceptors: Record<string, Interceptor> = {
  '*': DEFAULT_INTERCEPTOR,
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
  ],
  // https://github.com/facebook/jest/blob/c6512ad1b32a5d22aab9937300aa61aa87f76a27/packages/jest-cli/src/cli/args.js#L128
  ci: isCi, // Same behaviour as in Jest
  awaitConnectionsOnStop: false,
}
