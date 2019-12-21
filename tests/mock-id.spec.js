const getMockId = require('../dist/mock-id').default

it('Generates non-empty string', () => {
  const name = getMockId({ url: 'http://example.com/path/api' })

  expect(name).toBe('example.com-path-api--get-door-axe-winter')
})

it('Generates same id for the same request', () => {
  const params = {
    url: 'http://example.com/path/api',
    method: 'put',
    body: '123',
  }
  const name1 = getMockId({ ...params })
  const name2 = getMockId({ ...params })

  expect(name1).toBe(name2)
})

it('Accounts for hostname', () => {
  const name1 = getMockId({ url: 'http://example1.com' })
  const name2 = getMockId({ url: 'http://example2.com' })

  expect(name1).not.toBe(name2)
})

it('Accounts for path', () => {
  const name1 = getMockId({ url: 'http://example.com/path/one' })
  const name2 = getMockId({ url: 'http://example.com/path/two/three' })

  expect(name1).not.toBe(name2)
})

it('Accounts for method', () => {
  const name1 = getMockId({ url: 'http://e.com', method: 'post' })
  const name2 = getMockId({ url: 'http://e.com', method: 'get' })

  expect(name1).not.toBe(name2)
})

// Actually, not. Do you need that?
it.skip('Accounts for headers', () => {
  const name1 = getMockId({ url: 'http://e.com', headers: { foo: 'bar' } })
  const name2 = getMockId({ url: 'http://e.com', headers: { foo: 'bar2' } })

  expect(name1).not.toBe(name2)
})

it('Do not accounts for blacklisted query params', () => {
  const naming = {
    query: {
      blacklist: ['foo']
    }
  }
  const name1 = getMockId({ url: 'http://e.com?foo=1&bar=1', naming })
  const name2 = getMockId({ url: 'http://e.com?foo=2&bar=1', naming })

  expect(name1).toBe(name2)
})
