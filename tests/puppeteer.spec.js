const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer')
const waitPort = require('wait-port')
const rimraf = require('rimraf')
const signale = require('signale')
const sinon = require('sinon')
const { PendingXHR } = require('pending-xhr-puppeteer')
const mocker = require('../dist').default

async function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}

afterEach(async () => {
  await mocker.stop()
})

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
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      capture: {
        urls: ['localhost:3000/api'],
      },
    })

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

    // * stopping the mocker
    await mocker.stop()
  })

  it('generates mocks for POST request', async () => {
    const mockFilePath = path.resolve(__dirname, '../__teremocks-post__/localhost-api/post-jupiter-kitten-iowa.json')

    rimraf.sync(path.resolve(__dirname, '../__teremocks-post__'))
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      capture: {
        urls: ['localhost:3000/api'],
      },
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

    // * Stopping the mocker
    await mocker.stop()
  })

  it('Resolves `stop` even when no requests from capture.urls were made', async () => {
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

  it.skip('Fails `stop` in CI mode when no mock found', async () => {
    await page.goto('http://localhost:3000')

    // * Starting mocker with void capture.urls
    await mocker.start({
      page,
      capture: {
        urls: ['localhost:3000/api'],
      },
      ci: true,
      mockMiss: 'throw',
      awaitConnectionsOnStop: true
    })

    // * Typing `x` → invoking request to `/api`, which is not mocked
    await page.click('#input')
    await page.keyboard.type('x')
    await sleep(500)

    // * Expecting `stop` promise to reject, because no `mock file not found` (MONOFO)
    // await expect(mocker.stop()).rejects.toEqual('MONOFO')
  })

  describe.skip('mocker.set()', () => {
    it('Generates mocks in the custom working directory', async () => {
      const mockFilePath = path.resolve(__dirname, '../__extra-mocks__/localhost-api/get-app-diet-moon.json')

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

    // * stopping the mocker
    afterEach(async () => await mocker.stop())
  })

  describe('mockMiss', () => {
    it('Do not throws in CI with mockMiss === 200', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void capture.urls
      await mocker.start({
        page,
        capture: {
          urls: ['localhost:3000/api'],
        },
        ci: true,
        mockMiss: 200
      })

      // * Typing `x` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('x')

      // * Expecting `stop` promise to resolve, because mockMiss is number
      await expect(mocker.stop()).resolves.toEqual()
    })

    it('uses mockMiss middleware for response', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void capture.urls
      await mocker.start({
        page,
        capture: {
          urls: ['localhost:3000/api'],
        },
        ci: true,
        mockMiss: (next) => next({ body: JSON.stringify({ suggest: 'mockMiss_middleware' }) }),
      })

      // * Typing `x` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('x')

      // * Awaiting for middlware response and its body in suggest div
      await page.waitForFunction(() => {
        return document.querySelector('#suggest').innerText === '200 mockMiss_middleware'
      }, { timeout: 4000 })

      // * Expecting `stop` promise to resolve, because mockMiss is function
      await expect(mocker.stop()).resolves.toEqual()
    })

    it('Must not use mockMiss function if mock exists', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void capture.urls
      await mocker.start({
        page,
        capture: {
          urls: ['localhost:3000/api'],
        },
        ci: true,
        mockMiss: (next) => next({ body: JSON.stringify({ suggest: 'mockMiss_middleware' }) }),
      })

      // * Typing `x` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('a')

      // * Awaiting for middlware response and its body in suggest div
      await page.waitForFunction(() => {
        return document.querySelector('#suggest').innerText === '200 example'
      }, { timeout: 4000 })

      // * Expecting `stop` promise to resolve
      await expect(mocker.stop()).resolves.toEqual()
    })
  })

  describe('options.pass', () => {
    it('blocks cross origin requests out of capture.urls', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void `pass`
      await mocker.start({
        page,
        capture: {
          urls: ['http://localhost:3000'], // not localhost:4000!
        },
      })

      // * Typing `a` → invoking cors request to `/api`, which must be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')
      // await sleep(99999)

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === 'cors request failed'
      }, { timeout: 1000 })
    })

    it('blocks same origin non-GET requests out of capture.urls', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void `pass`
      await mocker.start({
        page,
        capture: { urls: [] }, // nothing for capture
      })

      // * Typing `a` → invoking POST request to `/api`, which must be blocked
      await page.click('#input-post')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-post').innerText === 'post request failed'
      }, { timeout: 1000 })
    })

    it('dont blocks cross origin request when url in pass.urls', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void `pass`
      await mocker.start({
        page,
        capture: { urls: [] }, // nothing to capture
        pass: { urls: ['http://localhost:4000'], methods: ['post'] },
      })

      // * Typing `a` → invoking CORS request to `/api`, which must not be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === '200 example'
      }, { timeout: 1000 })
    })

    it('dont blocks cross origin request when url in pass.urls, but with query', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void `pass`
      await mocker.start({
        page,
        capture: { urls: [] }, // nothing to capture
        pass: { urls: ['http://localhost:4000'], methods: ['post'] },
      })

      // * Typing `a` → invoking CORS request to `/api?q=a`, which must not be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === '200 example'
      }, { timeout: 1000 })
    })

    // * stopping the mocker
    afterEach(async () => await mocker.stop())
  })

  describe('options.capture', () => {
    it('capture GET request for /api', async () => {
      await page.goto('http://localhost:3000')

      // Custom storage for spying (fs wont be used)
      const storage = { set: sinon.spy(async () => ''), has: () => false }
      const capture = { urls: ['http://localhost:3000/api'] }

      // * Starting mocker with void `pass`
      await mocker.start({ page, storage, capture })

      // * Typing `a` → invoking cors request to `/api`
      await page.click('#input')
      await page.keyboard.type('a')
      await sleep(200)

      // * storage.set must be called, since the request is capturable
      expect(storage.set.calledOnce).toBe(true)
      expect(storage.set.getCall(0).args[0]).toBe('localhost-api--get-q-a')
    })

    it('dont capture GET request for /api when methods are ["post"]', async () => {
      await page.goto('http://localhost:3000')

      // Custom storage for spying (fs wont be used)
      const storage = { has: sinon.spy(async () => '') }
      const capture = {
        urls: ['http://localhost:3000/api'],
        methods: ['post']
      }

      // * Starting mocker with void `pass`
      await mocker.start({ page, storage, capture })

      // * Typing `a` → invoking cors request to `/api`
      await page.click('#input')
      await page.keyboard.type('a')
      await sleep(200)

      // * storage.has must not be called, since the request is not capturable
      expect(storage.has.called).toBe(false)
    })

    afterEach(async () => await mocker.stop())
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

  describe('mocker.mock', () => {
    it('mocker.mock simple case', async () => {
      const pendingXHR = new PendingXHR(page)
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create inline mock
      mocker.mock('http://localhost:3000/api', {
        suggest: 'mocker.mock suggest'
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      // * Awaiting for suggest request to finish
      await pendingXHR.waitForAllXhrFinished()

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 mocker.mock suggest')
      await mocker.stop()
    })

    it('remove handler', async () => {
      const pendingXHR = new PendingXHR(page)
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create inline mock
      const unmock = mocker.mock('http://localhost:3000/api', {
        suggest: 'mocker.mock suggest'
      })
      unmock()

      // * Invoking GET request to `/api`
      await page.click('#button')

      // * Awaiting for suggest request to finish
      await pendingXHR.waitForAllXhrFinished()
      await sleep(10)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 mocker.mock suggest')
      await mocker.stop()
    })

    it('ttfb', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })

      // * Create instant inline mock
      mocker.mock('http://localhost:3000/api', { suggest: 'mocker.mock suggest', ttfb: 0 })

      // * Typing `a` → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#input')
      await page.keyboard.type('a')

      // * Awaiting less than initial sleep (30 ms), but more than inline mocked sleep (0 ms)
      await sleep(1)
      const text = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text).toBe('200 mocker.mock suggest')

      await mocker.stop()
    })

    it('race condition', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({ page })
      mocker.mock({
        url: 'http://localhost:3000/api',
        query: { q: 'a' }
      }, {
        body: { suggest: 'custom A' },
        ttfb: 100,
      })

      mocker.mock({
        url: 'http://localhost:3000/api',
        query: { q: 'ab' }
      }, {
        body: { suggest: 'custom AB' },
        ttfb: 0,
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
