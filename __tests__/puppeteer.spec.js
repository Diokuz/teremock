const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer')
const waitPort = require('wait-port')
const rimraf = require('rimraf')
const signale = require('signale')
const sinon = require('sinon')
const mocker = require('../dist').default
const Mocker = require('../dist/mocker').default

async function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}

describe('teremock', () => {
  let page
  let browser
  let server

  beforeAll(async () => {
    const serverPath = path.resolve(__dirname, 'server')
    browser = await puppeteer.launch(process.env.D ? {
      headless: false,
      slowMo: 80,
    } : {})

    page = await browser.newPage()
    // Cant kill if detached: false (for reasons unknown)
    // Probably https://azimi.me/2014/12/31/kill-child_process-node-js.html
    server = spawn('node', [serverPath], { detached: true })
    server.stdout.on('data', function(data) {
      signale.info(data.toString())
      // process.stdout.write(data.toString())
    });
    await waitPort({ host: 'localhost', port: 3000 })
  })

  afterAll(async () => {
    await browser.close()
    // server.kill()
    process.kill(-server.pid)
  })

  it('generates mocks', async () => {
    const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-q-abcd.json')

    rimraf.sync(path.resolve(__dirname, '../__teremocks__'))

    // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
    await mocker.start({ page })
    await page.goto('http://localhost:3000')

    expect(fs.existsSync(mockFilePath)).toBe(false)

    // * Typing `abcd` → invoking request to `/api`
    await page.click('#input')
    await page.keyboard.type('abcd', { delay: 100 })

    // * wait for all connections to complete
    await mocker.connections()
    // @todo fix connections and write tests already!
    await sleep(500)

    // * At that point there must be mock files
    expect(fs.existsSync(mockFilePath)).toBe(true)
  })

  it('generates mocks for POST request', async () => {
    const mockFilePath = path.resolve(__dirname, '../__teremocks-post__/localhost-api/post-jupiter-kitten-iowa.json')

    rimraf.sync(path.resolve(__dirname, '../__teremocks-post__'))
    await mocker.stop()
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      wd: '__teremocks-post__',
    })

    expect(fs.existsSync(mockFilePath)).toBe(false)

    // * Typing `abcd` → invoking POST request to `/api`
    await page.click('#input-post')
    await page.keyboard.type('abcd', { delay: 10 })

    // * wait for all connections to complete
    await mocker.connections()

    // * At that point there must be mock files
    expect(fs.existsSync(mockFilePath)).toBe(true)

    // * stopping the mocker
    await mocker.stop()
  })

  it('uses existing mocks', async () => {
    await mocker.stop()
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      capture: {
        urls: ['localhost:3000/api'],
      },
    })

    // * Typing `a` → invoking request to `/api`, which are mocked
    await page.click('#input')
    await page.keyboard.type('a')

    // * Checking suggest in the div
    await sleep(100)
    const text = await page.evaluate(element => element.textContent, await page.$('#suggest'))
    expect(text).toBe('200 example')

    await mocker.stop()
  })

  it('Resolves `connections` even when no requests from capture.urls were made', async () => {
    await mocker.stop()
    await page.goto('http://localhost:3000')

    // * Starting mocker with void capture.urls
    await mocker.start({
      page,
      capture: {
        urls: [],
      },
    })

    // * Typing `a` → invoking request to `/api`, which is not mocked
    await page.click('#input')
    await page.keyboard.type('a')

    // * Awaiting for real response and its corresponding reaction (text `suggest: example` must appear)
    await page.waitForFunction(() => {
      return document.querySelector('#suggest').innerText === '200 example'
    }, { timeout: 4000 })

    // * All connections must resolves after theirs completion
    await expect(mocker.connections()).resolves.toEqual(undefined)
  })

  it('Resolves `stop` even when no requests from capture.urls were made', async () => {
    await mocker.stop()
    await page.goto('http://localhost:3000')

    // * Starting mocker with void capture.urls
    await mocker.start({
      page,
      capture: {
        urls: [],
      },
    })

    // * Typing `a` → invoking request to `/api`, which is not mocked
    await page.click('#input')
    await page.keyboard.type('a')

    // * Awaiting for real response and its corresponding reaction (text `suggest: example` must appear)
    await page.waitForFunction(() => {
      return document.querySelector('#suggest').innerText === '200 example'
    }, { timeout: 4000 })

    await expect(mocker.stop()).resolves.toEqual(undefined)
  })

  describe.skip('mocker.set()', () => {
    it('Generates mocks in the custom working directory', async () => {
      const mockFilePath = path.resolve(__dirname, '../__extra-mocks__/localhost-api/get-app-diet-moon.json')
      await mocker.stop()
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({
        page,
        capture: {
          urls: ['localhost:3000/api'],
        },
      })
      await mocker.set('wd', path.resolve(process.cwd(), '__extra-mocks__'))

      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Typing `abcd` → invoking request to `/api`
      await page.click('#input')
      await page.keyboard.type('abcd', { delay: 100 })

      // * mocker.stop waits for all connections
      await mocker.connections()
      await sleep(1000)

      // * At that point there must be mock files
      expect(fs.existsSync(mockFilePath)).toBe(true)
    })

    it('Changes request.status', async () => {
      await mocker.stop()
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({
        page,
        capture: {
          urls: ['localhost:3000/api'],
        },
      })

      // * Typing `a` → invoking request to `/api`
      await page.click('#input')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText with code 200
      await page.waitForFunction(() => {
        return document.querySelector('#suggest').innerText === '200 example'
      }, { timeout: 700 })

      await mocker.set('response', { status: 429 })
      await page.keyboard.type('b')

      // * Awaiting for suggest innerText with code 429
      await page.waitForFunction(() => {
        return document.querySelector('#suggest').innerText === '429 world'
      }, { timeout: 700 })
    })

    afterAll(() => {
      rimraf.sync(path.resolve(__dirname, '../__extra-mocks__'))
    })
  })

  describe('options.interceptors', () => {
    it('capture GET request for /api', async () => {
      await page.goto('http://localhost:3000')

      // Custom storage for spying (fs wont be used)
      const storage = { set: sinon.spy(async () => ''), has: () => false }
      const interceptors = {
        some_name: { url: '/api' }
      }

      // * Starting mocker with wildcard interceptor
      const mocker = new Mocker({ storage })
      await mocker.start({ page, interceptors })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(100)

      // * storage.set must be called, since the request is capturable
      // console.log('storage.set.getCall(0).args[0]', storage.set.getCall(0).args[0])
      expect(storage.set.calledOnce).toBe(true)
      expect(storage.set.getCall(0).args[0]).toBe('some_name--get-q-click')
      await mocker.stop()
    })

    it('dont capture GET request for /api when methods are ["post"]', async () => {
      await page.goto('http://localhost:3000')

      // Custom storage for spying (fs wont be used)
      const storage = { has: sinon.spy(async () => '') }
      // Custom interceptor
      const interceptors = {
        post: {
          url: '/api',
          methods: 'post'
        }
      }

      // * Starting mocker with only `post` interceptor
      await mocker.start({ page, storage, interceptors })

      // * Invoking request to `/api`
      await page.click('#button')
      await sleep(200)

      // * storage.has must not be called, since the request is not capturable
      expect(storage.has.called).toBe(false)
      await mocker.stop()
    })
  })

  describe('mocker.spy', () => {
    it('mocker.spy simple case', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })
      const spy = mocker.spy({
        url: 'http://localhost:3000/api',
        query: { q: 'ab' },
      })

      // * Typing `a` → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#input')
      await page.keyboard.type('a')
      await sleep(35)
      expect(spy.called).toBe(false)

      await page.keyboard.type('b')
      await sleep(35)
      expect(spy.called).toBe(true)

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await sleep(35)
      const text = await page.evaluate(element => element.textContent, await page.$('#suggest'))

      expect(text).toBe('200 world')
      await mocker.stop()
    })
  })

  describe('mocker.add', () => {
    it('mocker.add simple case', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create inline mock
      mocker.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'mocker.add suggest' } }
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 mocker.add suggest')
      await mocker.stop()
    })

    it('remove handler', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create inline mock
      const remove = mocker.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'mocker.add suggest' } }
      })
      remove()

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).not.toBe('200 mocker.add suggest')
      await mocker.stop()
    })

    it('ttfb', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create instant inline mock
      mocker.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'mocker.add suggest', ttfb: 0 } },
      })

      // * Invoking GET request to `/api`
      await page.click('#button')

      // * Awaiting less than initial sleep (30 ms), but more than inline mocked sleep (0 ms)
      await sleep(1)
      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 mocker.add suggest')
      await mocker.stop()
    })

    it('race condition', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })
      mocker.add({
        url: 'http://localhost:3000/api',
        query: { q: 'a' },
        response: {
          body: { suggest: 'custom A' },
          ttfb: 100,
        }
      })

      mocker.add({
        url: 'http://localhost:3000/api',
        query: { q: 'ab' },
        response: {
          body: { suggest: 'custom AB' },
          ttfb: 0,
        }
      })

      // * Typing `ab` → invoking two request to `/api`, which are inline mocked
      await page.click('#input')
      await page.keyboard.type('ab')

      // * Checking suggest in the div – second respond must return, but not the first
      await sleep(50)
      const text1 = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text1).toBe('200 custom AB')

      // * Waiting for the first response – it will overwrite the result of the second response
      // * because of race condition
      await sleep(150)
      const text2 = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text2).toBe('200 custom A')
      await mocker.stop()
    })
  })
})
