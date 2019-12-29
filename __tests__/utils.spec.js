const { findInterceptor, hasMatch, getQuery, isFilterMatched, blacklist, userOptionsToOptions } = require('../dist/utils')
const { DEFAULT_OPTIONS, DEFAULT_INTERCEPTOR_CAPTURE, DEFAULT_INTERCEPTOR_PASS } = require('../dist/consts')

describe('findInterceptor', () => {
  it('*', () => {
    const interceptors = DEFAULT_OPTIONS.interceptors
    const request = { url: 'http://example.com', method: 'get' }
    const found = findInterceptor({ interceptors, request })

    expect(found).toBe(DEFAULT_INTERCEPTOR_CAPTURE)
  })

  it('* resourceTypes: only xhr and fetch', () => {
    const interceptors = DEFAULT_OPTIONS.interceptors
    let request = { url: 'http://example.com', method: 'get', resourceType: 'xhr' }
    expect(findInterceptor({ interceptors, request })).toBe(DEFAULT_INTERCEPTOR_CAPTURE)

    request = { url: 'http://example.com', method: 'get', resourceType: 'fetch' }
    expect(findInterceptor({ interceptors, request })).toBe(DEFAULT_INTERCEPTOR_CAPTURE)

    request = { url: 'http://example.com', method: 'get', resourceType: 'other' }
    expect(findInterceptor({ interceptors, request })).toBe(DEFAULT_INTERCEPTOR_PASS)
  })

  it('* with query', () => {
    const interceptors = DEFAULT_OPTIONS.interceptors
    const request = { url: 'http://example.com', method: 'get', query: { foo: 'bar' } }
    const found = findInterceptor({ interceptors, request })

    expect(found).toBe(DEFAULT_INTERCEPTOR_CAPTURE)
  })

  it('two matched interceptors → first should be taken', () => {
    const interceptor = DEFAULT_OPTIONS.interceptors.capture
    const one = { ...interceptor }
    const two = { ...interceptor }
    const request = { url: 'http://example.com', method: 'get'}
    const found = findInterceptor({ interceptors: { one, two }, request })

    expect(found).toBe(one)
  })

  it('mismatched method', () => {
    const interceptor = {
      url: 'example.com',
      methods: new Set(['post'])
    }
    const request = { url: 'http://example.com', method: 'get'}
    const found = findInterceptor({ interceptors: { interceptor }, request })

    expect(found).toBeNull()
  })

  it('url matched partially (no protocol)', () => {
    const interceptor = {
      url: 'example.com',
      methods: new Set(['get'])
    }
    const request = { url: 'http://example.com', method: 'get'}
    const found = findInterceptor({ interceptors: { interceptor }, request })

    expect(found).toBe(interceptor)
  })

  it('url matched partially (no path)', () => {
    const interceptor = {
      url: 'example.com',
      methods: new Set(['get'])
    }
    const request = { url: 'http://example.com/path/to/api', method: 'get'}
    const found = findInterceptor({ interceptors: { interceptor }, request })

    expect(found).toBe(interceptor)
  })

  it('url matched partially (query in url)', () => {
    const interceptor = {
      url: 'example.com',
      methods: new Set(['get'])
    }
    const request = { url: 'http://example.com/path/to/api?foo=bar&baz=q', method: 'get'}
    const found = findInterceptor({ interceptors: { interceptor }, request })

    expect(found).toBe(interceptor)
  })

  it('query match', () => {
    const interceptor1 = {
      url: 'example.com',
      methods: new Set(['get']),
      query: {
        foo: 'bar',
      },
    }
    const interceptor2 = {
      ...interceptor1,
      query: {
        foo: 'bar2',
      },
    }
    const request1 = { url: 'http://example.com/?foo=bar', method: 'get' }
    const request2 = { url: 'http://example.com/?foo=bar2', method: 'get' }
    const found1 = findInterceptor({ interceptors: { interceptor1, interceptor2 }, request: request1 })
    const found2 = findInterceptor({ interceptors: { interceptor1, interceptor2 }, request: request2 })

    expect(found1).toBe(interceptor1)
    expect(found2).toBe(interceptor2)
  })
})

describe('hasMatch', () => {
  it('*', () => {
    const urls = ['*']
    const url = 'http://example.com'

    expect(hasMatch(urls, url)).toBe(true)
  })

  it('http://example1.com', () => {
    const urls = ['http://example1.com']
    const url = 'http://example2.com'

    expect(hasMatch(urls, url)).toBe(false)
  })
})

describe('getQuery', () => {
  it('no query', () => {
    expect(getQuery('http://example.com')).toEqual({})
  })

  it('foo=bar', () => {
    expect(getQuery('http://example.com?foo=bar')).toEqual({ foo: 'bar' })
  })
})

describe('isFilterMatched', () => {
  it('same url', () => {
    const filter = { url: 'http://example.com' }
    const request = { url: 'http://example.com' }

    expect(isFilterMatched(filter, request)).toBe(true)
  })

  it('different url', () => {
    const filter = { url: 'http://example.com' }
    const request = { url: 'http://example2.com' }

    expect(isFilterMatched(filter, request)).toBe(false)
  })

  it('baseUrl must match', () => {
    const filter = { baseUrl: 'http://example.com' }
    const request = { url: 'http://example.com/path/to/api' }

    expect(isFilterMatched(filter, request)).toBe(true)
  })

  it('url must not works as baseUrl', () => {
    const filter = { url: 'http://example.com' }
    const request = { url: 'http://example.com/path/to/api' }

    expect(isFilterMatched(filter, request)).toBe(false)
  })

  it('query must not affect url match', () => {
    const filter = { url: 'http://example.com' }
    const request = { url: 'http://example.com?foo=bar' }

    expect(isFilterMatched(filter, request)).toBe(true)
  })

  it('query in filter and in url may be in different form, match', () => {
    const filter = { url: 'http://example.com', query: { foo: 'bar' } }
    const request = { url: 'http://example.com?foo=bar' }

    expect(isFilterMatched(filter, request)).toBe(true)
  })

  it('query in filter and in url may be in different form, no match', () => {
    const filter = { url: 'http://example.com', query: { foo: 'baz' } }
    const request = { url: 'http://example.com?foo=bar' }

    expect(isFilterMatched(filter, request)).toBe(false)
  })
})

describe('blacklist', () => {
  it('void list', () => {
    const result = blacklist({ foo: 1 }, [])

    expect(result).toEqual({ foo: 1 })
  })

  it('must return an enmty object', () => {
    const result = blacklist({ foo: 1 }, ['foo'])

    expect(result).toEqual({})
  })

  it('must not account for case', () => {
    const result = blacklist({ Foo: 1, bAr: 2 }, ['fOo', 'baR'])

    expect(result).toEqual({})
  })
})

describe('userOptionsToOptions', () => {
  it('no options', () => {
    const options = userOptionsToOptions(DEFAULT_OPTIONS, {})

    expect(options).toEqual(DEFAULT_OPTIONS)
  })

  it('one mock', () => {
    const apiMock = {
      url: 'example.com',
      methods: 'get,post,patch',
    }
    const options = userOptionsToOptions(DEFAULT_OPTIONS, {
      interceptors: {
        api: apiMock
      }
    })

    expect(options).toEqual({
      ...DEFAULT_OPTIONS,
      interceptors: {
        ...DEFAULT_OPTIONS.interceptors,
        api: {
          ...DEFAULT_INTERCEPTOR_CAPTURE,
          ...apiMock,
          name: 'api',
          methods: new Set(apiMock.methods.split(',')),
        },
      },
    })
  })
})
