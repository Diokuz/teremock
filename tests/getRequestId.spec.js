const getRequestId = require('../src/getRequestId').default

it('Generates same names for same request', () => {
  const name1 = getRequestId({ url: 'http://example.com' })
  const name2 = getRequestId({ url: 'http://example.com' })

  expect(name1).toBe('get-october-leopard-owe')
  expect(name2).toBe(name1)
})

it('Generates prefix according to method', () => {
  const nameGet = getRequestId({ url: 'http://example.com', method: 'gEt' })
  const namePatch = getRequestId({ url: 'http://example.com', method: 'PATCH' })

  expect(nameGet).toBe('get-october-leopard-owe')
  expect(namePatch).toBe('patch-october-leopard-owe')
})

it('params from query.blacklist does not affects output name', () => {
  const naming = { query: { blacklist: ['foo'] } }
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&x=y', naming })
  const name2 = getRequestId({ url: 'http://example.com?x=y&foo=bazzzzz', naming })

  expect(name1).toBe(name2)
})

it('params outside of query.whitelist does not affect output name', () => {
  const naming = { query: { whitelist: ['foo'] } }
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&y=x', naming })
  const name2 = getRequestId({ url: 'http://example.com?foo=bar', naming })

  expect(name1).toBe(name2)
})

it('params out of the whitelist does not affect output name', () => {
  const naming = { query: { whitelist: ['foo'] } }
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&x=y&y=x', naming })
  const name2 = getRequestId({ url: 'http://example.com?foo=bar', naming })

  expect(name1).toBe(name2)
})

it('whitelist with two params', () => {
  const naming = { query: { whitelist: ['foo', 'trois'] } }
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&trois=quatre&x=y', naming })
  const name2 = getRequestId({ url: 'http://example.com?trois=quatre&foo=bar', naming })

  expect(name1).toBe(name2)
})

it('query.blacklist and whitelist at the same time', () => {
  const naming = { query: { blacklist: ['foo'], whitelist: ['foo', 'trois'] } }
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&trois=quatre&x=y', naming })
  const name2 = getRequestId({ url: 'http://example.com?trois=quatre&foo=bar', naming })

  expect(name1).toBe(name2)
})

it('params from body.blacklist for request with content-type="application/json" does not affects output name', () => {
  const method = 'POST'
  const naming = { body: { blacklist: ['foo'] } }
  const headers = { 'content-type': 'application/json' }
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: 'bar', x: 2 }),
    naming
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: 'bazzzz', x: 2 }),
    naming
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request with content-type="application/x-www-form-urlencoded" does not affects output name', () => {
  const naming = { body: { blacklist: ['foo'] } }
  const headers = { 'content-type': 'application/x-www-form-urlencoded' }

  const name1 = getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bar&x=2",
    naming
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bazzzz&x=2",
    naming
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request without content-type affects output name', () => {
  const method = 'POST'
  const naming = { body: { blacklist: ['foo'] } }
  const headers = {}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bar&x=2",
    naming
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bazzzz&x=2",
    naming
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request with not supported content-type affects output name', () => {
  const method = 'POST'
  const naming = { body: { blacklist: ['foo'] } }
  const headers =  { 'content-type': 'multipart/form-data' }
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: 'foo=bar&x=2',
    naming
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: 'foo=bazzzz&x=2',
    naming
  })

  expect(name1).toBe(name2)
})

it('Skip nested post body params', () => {
  const method = 'POST'
  const naming = { body: { blacklist: [['foo', 'bar']] } }
  const headers = {"content-type": "application/json"}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: { bar: 1 }, baz: 2 }),
    naming
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: { bar: 2 }, baz: 2 }),
    naming
  })

  expect(name1).toBe(name2)
})

it('Nonexistent level of nested body parameters does not throw an error', () => {
  const naming = { body: { blacklist: [['foo', 'bar', 'baz']] } }

  getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers:{ 'content-type': 'application/json' },
    postData: JSON.stringify({ foo: 1 }),
    naming
  })
})

it('Non-json post body does not throws an error', () => {
  getRequestId({ url: 'http://example.com', postData: 'post_body' })
})
