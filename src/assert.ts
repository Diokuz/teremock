import assert from 'assert'
// import signale from 'signale'
import type { UserOptions, UserInterceptor } from './types'

function assertIsPage(maybePage: any, prefix: string): asserts maybePage is any {
  if (typeof maybePage.mainFrame !== 'function') {
    const message = prefix + 'not a valid page! Method page.mainFrame() not found.'
    throw new assert.AssertionError({ message })
  }
}

function assertIsOptionalBoolean(val: any, message: string): asserts val is boolean {
  if (typeof val !== 'undefined' && typeof val !== 'boolean') {
    throw new assert.AssertionError({ message })
  }
}

function assertIsOptionalString(val: any, message: string): asserts val is string {
  if (typeof val !== 'undefined' && typeof val !== 'string') {
    throw new assert.AssertionError({ message })
  }
}

function assertIsStringOrStringArray(val: any, prefix: string): asserts val is string | string[] {
  const isString = typeof val === 'string'
  const isStringArray = Array.isArray(val) && val.every(item => typeof item === 'string')

  if (!isString && !isStringArray) {
    const message = prefix + 'not a string or string[]'
    throw new assert.AssertionError({ message })
  }
}

function assertIsUserInterceptor(val: any, prefix: string): asserts val is UserInterceptor {
  assertIsOptionalString(val.name, prefix + 'interceptor.name must be a string')
  assertIsOptionalString(val.url, prefix + 'interceptor.url must be a string')

  assertIsOptionalBoolean(val.pass, prefix + 'interceptor.pass must be boolean')

  assertIsOptionalString(val.name, prefix + 'interceptor.name must be a string')
  assertIsOptionalString(val.name, prefix + 'interceptor.name must be a string')

  if (typeof val.name !== 'undefined' && typeof val.name !== 'string') {
    const message = prefix + 'interceptor.name must be a string'
    throw new assert.AssertionError({ message })
  }

  if (typeof val.url !== 'undefined' && typeof val.url !== 'string') {
    const message = prefix + 'interceptor.url must be a string'
    throw new assert.AssertionError({ message })
  }

  if (typeof val.url !== 'undefined' && typeof val.url !== 'string') {
    const message = prefix + 'interceptor.url must be a string'
    throw new assert.AssertionError({ message })
  }
}

export function assertUserOptions(userOptions: any, msg = 'teremock.start() options validation: '): asserts userOptions is UserOptions {
  if (typeof userOptions.page !== 'undefined') {
    assertIsPage(userOptions.page, msg)
  }

  if (typeof userOptions.wd !== 'undefined') {
    assertIsStringOrStringArray(userOptions.wd, msg)
  }

  if (typeof userOptions.interceptors !== 'undefined') {
    Object.keys(userOptions.interceptors).forEach(key => {
      return assertIsUserInterceptor(userOptions.interceptors[key], msg + key + ' ')
    })
  }
}
