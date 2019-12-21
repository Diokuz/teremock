const getFileName = require('../dist/storage').getFileName
const getMockId = require('../dist/mock-id').default

it('filename for domain with path', () => {
  const mockId = getMockId({ url: 'http://example.com/path/api' })
  const name = getFileName({ mockId, wd: '/diokuz/dir' })

  expect(name).toBe('/diokuz/dir/example.com-path-api/get-door-axe-winter.json')
})

it('filename for domain with path/', () => {
  const mockId = getMockId({ url: 'http://example.com/path/api/' })
  const name = getFileName({ mockId, wd: '/diokuz/dir' })

  expect(name.startsWith('/diokuz/dir/example.com-path-api/get-')).toBe(true)
})
