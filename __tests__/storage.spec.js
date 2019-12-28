const fs = require('fs')
const path = require('path')
const getFileName = require('../dist/storage').getFileName
const Storage = require('../dist/storage').default
const getMockId = require('../dist/mock-id').default
const rimraf = require('rimraf')

const PROJECT_ROOT = process.cwd()

it('filename for domain with path', () => {
  const name = getFileName({ mockId: 'a--b', wd: '/diokuz/dir' })

  expect(name).toBe('/diokuz/dir/a/b.json')
})

it('filename for domain with path/', () => {
  const name = getFileName({ mockId: 'example-com--path-api', wd: '/diokuz/dir' })

  expect(name).toBe('/diokuz/dir/example-com/path-api.json')
})

describe('storage.get', () => {
  it('not exist', async () => {
    const mockId = getMockId({ url: 'http://example.com/path/api/', naming: {} })
    const storage = new Storage({ wd: __dirname })

    expect(storage.get(mockId)).rejects.toBeTruthy()
  })

  it('exists', async () => {
    const wd = path.resolve(PROJECT_ROOT, '__teremocks__')
    const storage = new Storage({ wd })
    const data = await storage.get('localhost-api--get-q-a')

    expect(data.request.method).toBe('GET')
  })
})

describe('storage.set', () => {
  const wd = path.resolve(__dirname, '__temp__')

  afterEach(() => {
    rimraf.sync(wd)
  })

  it('must create file with mock', async () => {
    const mockId = getMockId({ url: 'http://example.com/path/api/', naming: {} })
    const storage = new Storage({ wd })

    await storage.set(mockId, 'data')
    const fn = storage._getFn(mockId)

    expect(fs.existsSync(fn)).toBe(true)
  })

  it('must not fail if file already exists', async () => {
    const mockId = getMockId({ url: 'http://example.com/path/api/', naming: {} })
    const storage = new Storage({ wd })
    await storage.set(mockId, 'data')
    const fn = storage._getFn(mockId)

    expect(fs.existsSync(fn)).toBe(true)

    await storage.set(mockId, 'data')
  })

  // @todo make -u flag for updating mocks
  // @important! You cannot update mocks without deleting them for now!
  it('must update existing mock', async () => {
    const mockId = getMockId({ url: 'http://example.com/path/api/', naming: {} })
    const storage = new Storage({ wd })

    await storage.set(mockId, 'data')
    await storage.set(mockId, 'data2')
    const fn = storage._getFn(mockId)

    const actualData = fs.readFileSync(fn, { encoding: 'utf-8' })

    expect(actualData).toBe(JSON.stringify('data2'))
  })
})
