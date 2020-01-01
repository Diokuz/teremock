const getMockId = require('../src/mock-id').default

const naming = {}

it('generates non-empty string', () => {
  const name = getMockId({ url: 'http://example.com/path/api', naming })

  expect(name).toBe('example.com-path-api--get')
})

it('custom name', () => {
  const name = getMockId({ url: 'http://example.com/path/api', naming, name: 'api' })

  expect(name).toBe('api--get')
})

it('generates same id for the same request', () => {
  const params = {
    url: 'http://example.com/path/api',
    method: 'put',
    body: '123',
  }
  const name1 = getMockId({ ...params, naming })
  const name2 = getMockId({ ...params, naming })

  expect(name1).toBe(name2)
})

it('accounts for hostname', () => {
  const name1 = getMockId({ url: 'http://example1.com', naming })
  const name2 = getMockId({ url: 'http://example2.com', naming })

  expect(name1).not.toBe(name2)
})

it('accounts for path', () => {
  const name1 = getMockId({ url: 'http://example.com/path/one', naming })
  const name2 = getMockId({ url: 'http://example.com/path/two/three', naming })

  expect(name1).not.toBe(name2)
})

it('accounts for method', () => {
  const name1 = getMockId({ url: 'http://e.com', method: 'post', naming })
  const name2 = getMockId({ url: 'http://e.com', method: 'get', naming })

  expect(name1).not.toBe(name2)
})

// Actually, not. Do you need that?
it.skip('accounts for headers', () => {
  const name1 = getMockId({ url: 'http://e.com', headers: { foo: 'bar' }, naming })
  const name2 = getMockId({ url: 'http://e.com', headers: { foo: 'bar2' }, naming })

  expect(name1).not.toBe(name2)
})

it('Do not accounts for blacklisted query params', () => {
  const customNaming = {
    query: {
      blacklist: ['foo']
    }
  }
  const name1 = getMockId({ url: 'http://e.com?foo=1&bar=1', naming: customNaming })
  const name2 = getMockId({ url: 'http://e.com?foo=2&bar=1', naming: customNaming })

  expect(name1).toBe(name2)
})
