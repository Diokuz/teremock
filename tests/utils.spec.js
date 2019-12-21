const { hasMatch, getQuery, isSpyMatched } = require('../dist/utils')

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

describe('isSpyMatched', () => {
  it('same location', () => {
    const spyFilter = { location: 'http://example.com' }
    const request = { location: 'http://example.com' }

    expect(isSpyMatched(spyFilter, request)).toBe(true)
  })

  it('different location', () => {
    const spyFilter = { location: 'http://example.com' }
    const request = { location: 'http://example2.com' }

    expect(isSpyMatched(spyFilter, request)).toBe(false)
  })

  it('matched query', () => {
    const spyFilter = { query: { foo: 'bar' } }
    const request = { query: { foo: 'bar', baz: 1 } }

    expect(isSpyMatched(spyFilter, request)).toBe(true)
  })
})
