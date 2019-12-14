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

it('skipQueryParams does not affects output name', () => {
  const skipQueryParams = ['foo']
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&x=y', skipQueryParams })
  const name2 = getRequestId({ url: 'http://example.com?x=y&foo=bazzzzz', skipQueryParams })

  expect(name1).toBe(name2)
})

it('queryParams does not affect output name', () => {
  const queryParams = ['foo']
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&y=x', queryParams })
  const name2 = getRequestId({ url: 'http://example.com?foo=bar', queryParams })

  expect(name1).toBe(name2)
})

it('unnecessary params bigger than 1 does not affect output name', () => {
  const queryParams = ['foo']
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&x=y&y=x', queryParams })
  const name2 = getRequestId({ url: 'http://example.com?foo=bar', queryParams })

  expect(name1).toBe(name2)
})

it('queryParams > 1 does not affect output name', () => {
  const queryParams = ['foo', 'trois']
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&trois=quatre&x=y', queryParams })
  const name2 = getRequestId({ url: 'http://example.com?trois=quatre&foo=bar', queryParams })

  expect(name1).toBe(name2)
})

it('skip params from queryParams does not affect output name', () => {
  const queryParams = ['foo', 'trois']
  const skipQueryParams = ['foo']
  const name1 = getRequestId({ url: 'http://example.com?foo=bar&trois=quatre&x=y', queryParams, skipQueryParams })
  const name2 = getRequestId({ url: 'http://example.com?trois=quatre&foo=bar', queryParams, skipQueryParams })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request with content-type="application/json" does not affects output name', () => {
  const method = 'POST'
  const skipPostParams = ['foo']
  const headers = {"content-type": "application/json"}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: 'bar', x: 2 }),
    skipPostParams
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: 'bazzzz', x: 2 }),
    skipPostParams
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request with content-type="application/x-www-form-urlencoded" does not affects output name', () => {
  const skipPostParams = ['foo']
  const headers = {"content-type": "application/x-www-form-urlencoded"}

  const name1 = getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bar&x=2",
    skipPostParams
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bazzzz&x=2",
    skipPostParams
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request without content-type affects output name', () => {
  const method = 'POST'
  const skipPostParams = ['foo']
  const headers = {}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bar&x=2",
    skipPostParams
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bazzzz&x=2",
    skipPostParams
  })

  expect(name1).toBe(name2)
})

it('Skipped post body params for request with not supported content-type affects output name', () => {
  const method = 'POST'
  const skipPostParams = ['foo']
  const headers =  {"content-type": "multipart/form-data"}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bar&x=2",
    skipPostParams
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: "foo=bazzzz&x=2",
    skipPostParams
  })

  expect(name1).toBe(name2)
})

it('Skip nested post body params', () => {
  const method = 'POST'
  const skipPostParams = [['foo', 'bar']]
  const headers = {"content-type": "application/json"}
  const name1 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: { bar: 1 }, baz: 2 }),
    skipPostParams
  })
  const name2 = getRequestId({
    url: 'http://example.com',
    method,
    headers,
    postData: JSON.stringify({ foo: { bar: 2 }, baz: 2 }),
    skipPostParams
  })

  expect(name1).toBe(name2)
})

it('Nonexistent level of nested body parameters does not throw an error', () => {
  getRequestId({
    url: 'http://example.com',
    method: 'POST',
    headers:{ 'content-type': 'application/json' },
    postData: JSON.stringify({ foo: 1 }),
    skipPostParams: [['foo', 'bar', 'baz']]
  })
})

it('Non-json post body does not throws an error', () => {
  getRequestId({ url: 'http://example.com', postData: 'post_body' })
})
