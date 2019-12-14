const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer')
const waitPort = require('wait-port')
const rimraf = require('rimraf')
const signale = require('signale')
const mocker = require('../dist').default

async function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}

describe('connections', () => {
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

  it('Generates mocks', async () => {
    const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-app-diet-moon.json')

    rimraf.sync(path.resolve(__dirname, '../__teremocks__'))
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      mockList: 'localhost:3000/api',
    })

    expect(fs.existsSync(mockFilePath)).toBe(false)

    // * Typing `abcd` → invoking request to `/api`
    await page.click('#input')
    await page.keyboard.type('abcd', { delay: 100 })

    // * wait for all connections to complete
    await mocker.connections()

    // * At that point there must be mock files
    expect(fs.existsSync(mockFilePath)).toBe(true)

    // * stopping the mocker
    await mocker.stop()
  })

  it('Generates mocks for POST request', async () => {
    const mockFilePath = path.resolve(__dirname, '../__teremocks-post__/localhost-api/post-diet-sink-color.json')

    rimraf.sync(path.resolve(__dirname, '../__teremocks-post__'))
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      mockList: 'localhost:3000/api',
      namespace: '__teremocks-post__',
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

  it('Uses existing mocks', async () => {
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await mocker.start({
      page,
      mockList: 'localhost:3000/api',
    })

    // * Typing `abc` → invoking request to `/api`, which are mocked
    await page.click('#input')
    await page.keyboard.type('abc')

    // * Because all requests are mocked, they respond instantly, without delay
    // * So, page reaction on the response must be within 100 ms
    // * Checking that reaction: there must be a text `green` in the suggest div
    await page.waitForFunction(() => {
      return document.querySelector('#suggest').innerText === '200 green'
    }, { timeout: 100 })

    await mocker.stop()
  })

  it('Resolves `connections` even when no requests from mockList were made', async () => {
    await page.goto('http://localhost:3000')

    // * Starting mocker with void mockList
    await mocker.start({
      page,
      mockList: null,
    })

    // * Typing `abc` → invoking request to `/api`, which is not mocked
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

  it('Resolves `stop` even when no requests from mockList were made', async () => {
    await page.goto('http://localhost:3000')

    // * Starting mocker with void mockList
    await mocker.start({
      page,
      mockList: null,
    })

    // * Typing `abc` → invoking request to `/api`, which is not mocked
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

    // * Starting mocker with void mockList
    await mocker.start({ page, mockList: 'localhost:3000/api', ci: true, mockMiss: 'throw', awaitConnectionsOnStop: true })

    // * Typing `x` → invoking request to `/api`, which is not mocked
    await page.click('#input')
    await page.keyboard.type('x')
    await sleep(500)

    // * Expecting `stop` promise to reject, because no `mock file not found` (MONOFO)
    // await expect(mocker.stop()).rejects.toEqual('MONOFO')
  })

  describe('mocker.set()', () => {
    it('Generates mocks in extra workDir', async () => {
      const mockFilePath = path.resolve(__dirname, '../__extra-mocks__/localhost-api/get-app-diet-moon.json')

      await page.goto('http://localhost:3000')

      // * Starting mocker
      await mocker.start({
        page,
        mockList: 'localhost:3000/api',
      })
      await mocker.set('workDir', path.resolve(process.cwd(), '__extra-mocks__'))

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
        mockList: 'localhost:3000/api',
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

      // * Starting mocker with void mockList
      await mocker.start({ page, mockList: 'localhost:3000/api', ci: true, mockMiss: 200 })

      // * Typing `x` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('x')

      // * Expecting `stop` promise to resolve, because mockMiss is number
      await expect(mocker.stop()).resolves.toEqual()
    })

    it('Uses mockMiss middleware for response', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void mockList
      await mocker.start({
        page,
        mockList: 'localhost:3000/api',
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

      // * Starting mocker with void mockList
      await mocker.start({
        page,
        mockList: 'localhost:3000/api',
        ci: true,
        mockMiss: (next) => next({ body: JSON.stringify({ suggest: 'mockMiss_middleware' }) }),
      })

      // * Typing `x` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('abc')

      // * Awaiting for middlware response and its body in suggest div
      await page.waitForFunction(() => {
        return document.querySelector('#suggest').innerText === '200 green'
      }, { timeout: 4000 })

      // * Expecting `stop` promise to resolve
      await expect(mocker.stop()).resolves.toEqual()
    })
  })

  describe('options.passList', () => {
    it('blocks cross origin requests by default', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void passList
      await mocker.start({ page })

      // * Typing `a` → invoking cors request to `/api`, which must be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === 'cors request failed'
      }, { timeout: 1000 })
    })

    it('blocks same origin non-GET requests by default', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void passList
      await mocker.start({ page })

      // * Typing `a` → invoking POST request to `/api`, which must be blocked
      await page.click('#input-post')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-post').innerText === 'post request failed'
      }, { timeout: 1000 })
    })

    it('dont blocks cross origin request when url in passList', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void passList
      await mocker.start({ page, passList: ['http://localhost:4000'] })

      // * Typing `a` → invoking CORS request to `/api`, which must not be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === '200 example'
      }, { timeout: 1000 })
    })

    it('dont blocks cross origin request when url in passList, but with query', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void passList
      await mocker.start({ page, passList: ['http://localhost:4000'] })

      // * Typing `a` → invoking CORS request to `/api?q=a`, which must not be blocked
      await page.click('#input-cors')
      await page.keyboard.type('a')

      // * Awaiting for suggest innerText, which indicates wether request was blocked
      await page.waitForFunction(() => {
        return document.querySelector('#suggest-cors').innerText === '200 example'
      }, { timeout: 1000 })
    })

    it('navigation request should not be blocked', async () => {
      // * Starting mocker without passList
      await mocker.start({ page })

      // * Goto 'about:blank' → 'localhost:3000' some url – that url should not be blocked
      await page.goto('http://localhost:3000')
      await page.waitFor('#suggest')

      // * Goto 'localhost:3000' → 'localhost:4000/text' some url – that url should not be blocked
      await page.goto('http://localhost:4000/text')
      await page.waitFor('#text')
    })

    afterEach(async () => await mocker.stop())
  })
})

