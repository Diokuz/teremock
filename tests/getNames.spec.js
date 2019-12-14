const getNames = require('../dist/storage').__getNames

// url, method, postData = '', workDir, skipQueryParams = [], skipPostParams = []

it('Generates filename for domain without slash', () => {
  const names = getNames({
    url: 'http://example.com',
    workDir: '/diokuz/dir'
  })

  expect(names.targetDir).toBe('/diokuz/dir/example.com')
  expect(names.absFileName).toBe('/diokuz/dir/example.com/get-october-leopard-owe')
})

it('Generates filename for domain with slash', () => {
  const names = getNames({
    url: 'http://example.com/',
    workDir: '/diokuz/dir',
  })

  expect(names.targetDir).toBe('/diokuz/dir/example.com')
  expect(names.absFileName).toBe('/diokuz/dir/example.com/get-october-leopard-owe')
})

it('Generates filename for domain with slugs', () => {
  const names = getNames({
    url: 'http://example.com/foo/bar',
    workDir: '/diokuz/dir',
  })

  expect(names.targetDir).toBe('/diokuz/dir/example.com-foo-bar')
  expect(names.absFileName).toBe('/diokuz/dir/example.com-foo-bar/get-october-lithium-oven')
})

it('Generates filename for domain with slugs and trailing slash', () => {
  const names = getNames({
    url: 'http://example.com/foo/bar/',
    workDir: '/diokuz/dir',
  })

  expect(names.targetDir).toBe('/diokuz/dir/example.com-foo-bar')
  expect(names.absFileName).toBe('/diokuz/dir/example.com-foo-bar/get-papa-oil-london')
})

it('Generates different filenames for different query params', () => {
  const names1 = getNames({
    url: 'http://example.com/foo/bar/?foo=bar',
    workDir: '/diokuz/dir',
  })
  const names2 = getNames({
    url: 'http://example.com/foo/bar/?baz=1',
    workDir: '/diokuz/dir',
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com-foo-bar/get-mars-node-nine')
  expect(names1.absFileName).not.toBe(names2.absFileName)
})

it('Generates same filenames for different skipped query params', () => {
  const names1 = getNames({
    url: 'http://example.com/foo/bar/?foo=bar&x=y',
    workDir: '/diokuz/dir',
    skipQueryParams: ['random']
  })
  const names2 = getNames({
    url: 'http://example.com/foo/bar/?foo=bar&x=y&random=123',
    workDir: '/diokuz/dir',
    skipQueryParams: ['random']
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com-foo-bar/get-fruit-ark-beam')
  expect(names1.absFileName).toBe(names2.absFileName)
})

it('Generates same filenames for different order of query params', () => {
  const names1 = getNames({
    url: 'http://example.com/foo/bar/?foo=bar&x=y',
    workDir: '/diokuz/dir',
    skipQueryParams: ['random']
  })
  const names2 = getNames({
    url: 'http://example.com/foo/bar/?x=y&foo=bar',
    workDir: '/diokuz/dir'
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com-foo-bar/get-fruit-ark-beam')
  expect(names1.absFileName).toBe(names2.absFileName)
})

it('Generates different filenames for different post bodies without content-type', () => {
  const names1 = getNames({
    url:'http://example.com',
    method: 'POST',
    postData: 'post_body_1',
    workDir: '/diokuz/dir'
  })
  const names2 = getNames({
    url: 'http://example.com',
    method: 'POST',
    postData: 'post_body_2',
    workDir: '/diokuz/dir'
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com/post-romeo-flux-chicken')
  expect(names1.absFileName).not.toBe(names2.absFileName)
})

it('Generates different filenames for different FromData post bodies', () => {
  const headers = {"content-type": "application/x-www-form-urlencoded"}

  const names1 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bar&x=2",
    workDir: '/diokuz/dir'
  })
  const names2 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bazzzz&x=2",
    workDir: '/diokuz/dir'
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com/post-jet-mars-table')
  expect(names1.absFileName).not.toBe(names2.absFileName)
})

it('Generates different filenames for different JSON post bodies', () => {
  const headers = {"content-type": "application/json"}

  const names1 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: JSON.stringify({ id: 1, randomId: 2, timestamp: 123 }),
    workDir: '/diokuz/dir'
  })
  const names2 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: JSON.stringify({ id: 1, randomId: 3, timestamp: 321 }),
    workDir: '/diokuz/dir'
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com/post-failed-monkey-hotel')
  expect(names1.absFileName).not.toBe(names2.absFileName)
})

it('Generates same filenames for different skipped FormData post bodies', () => {
  const skipPostParams = ['foo']

  const headers = {"content-type": "application/x-www-form-urlencoded"}
  const names1 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bar&x=2",
    workDir: '/diokuz/dir',
    skipPostParams
  })
  const names2 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: "foo=bazzzz&x=2",
    workDir: '/diokuz/dir',
    skipPostParams
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com/post-lamp-echo-jupiter')
  expect(names1.absFileName).toBe(names2.absFileName)
})

it('Generates same filenames for different skipped JSON post bodies', () => {
  const skipPostParams = ['randomId', 'timestamp']

  const headers = {"content-type": "application/json"}
  const names1 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: JSON.stringify({ id: 1, randomId: 2, timestamp: 123 }),
    workDir: '/diokuz/dir',
    skipPostParams
  })
  const names2 = getNames({
    url: 'http://example.com',
    method: 'POST',
    headers,
    postData: JSON.stringify({ id: 1, randomId: 3, timestamp: 321 }),
    workDir: '/diokuz/dir',
    skipPostParams
  })

  expect(names1.absFileName).toBe('/diokuz/dir/example.com/post-equal-uniform-ice')
  expect(names1.absFileName).toBe(names2.absFileName)
})
