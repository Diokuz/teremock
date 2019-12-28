const { hasMatch, getQuery, isFilterMatched, blacklist } = require('../dist/utils')

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
