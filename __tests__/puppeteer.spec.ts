import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import rimraf from 'rimraf'
import sinon from 'sinon'
import teremock, { Teremock } from '../src'
import { parseUrl } from '../src/utils'
import { setup as setupDevServer, teardown as teardownDevServer } from 'jest-process-manager'

import type { Page, Browser } from 'puppeteer'
import type { Request } from '../src/types'

async function sleep(time: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

describe('teremock puppeteer', () => {
  let page: Page
  let browser: Browser

  beforeAll(async () => {
    const serverPath = path.resolve(__dirname, 'server')
    await setupDevServer({
      command: `node ${serverPath}`,
      port: 3000,
      usedPortAction: 'kill',
    })

    browser = await puppeteer.launch(process.env.D ? {
      headless: false,
      slowMo: 80,
      devtools: true,
    } : {})

    page = await browser.newPage()
  })

  afterAll(async () => {
    await browser.close()
    await teardownDevServer()
  })

  describe('basic', () => {
    it('generates mocks', async () => {
      const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-q-abcd.json')

      rimraf.sync(path.resolve(__dirname, '../__teremocks__'))

      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({ page })
      await page.goto('http://localhost:3000')

      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Typing `abcd` → invoking request to `/api`
      await page.click('#input')
      await page.keyboard.type('abcd', { delay: 100 })

      // * wait for all connections to complete
      await teremock.connections()
      // @todo fix connections and write tests already!
      await sleep(500)

      // * At that point there must be mock files
      expect(fs.existsSync(mockFilePath)).toBe(true)
    })

    it('generates mocks to utf-8', async () => {
      const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-bark-seven-emma.json')

      rimraf.sync(mockFilePath)

      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({ page })
      await page.goto('http://localhost:3000')

      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Typing `фt` → invoking request to `/api`
      // (page.keyboard.type does not invokes keyup handler for cyrillic letters for reasons unknown)
      await page.click('#input')
      await page.keyboard.type('фt')

      // * wait for all connections to complete
      await teremock.connections()
      // @todo fix connections and write tests already!
      await sleep(500)

      // * At that point there must be mock files
      expect(fs.existsSync(mockFilePath)).toBe(true)
      expect(JSON.parse(fs.readFileSync(mockFilePath, { encoding: 'utf-8' })).response.body.suggest).toBe('фt')
    })

    it('generates mocks for POST request', async () => {
      const mockFilePath = path.resolve(__dirname, '../__teremocks-post__/localhost-api/post-jupiter-kitten-iowa.json')

      rimraf.sync(path.resolve(__dirname, '../__teremocks-post__'))
      await teremock.stop()
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({
        page,
        wd: '__teremocks-post__',
      })

      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Typing `abcd` → invoking POST request to `/api`
      await page.click('#input-post')
      await page.keyboard.type('abcd', { delay: 10 })

      // * wait for all connections to complete
      await teremock.connections()

      // * At that point there must be mock files
      expect(fs.existsSync(mockFilePath)).toBe(true)

      // * stopping the mocker
      await teremock.stop()
    })

    it('uses existing mocks', async () => {
      await teremock.stop()
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Typing `a` → invoking request to `/api`, which are mocked
      await page.click('#input')
      await page.keyboard.type('a')

      // * Checking suggest in the div
      await sleep(100)
      const text = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text).toBe('200 example')

      await teremock.stop()
    })

    it.skip('Resolves `connections` even when no requests from capture.urls were made', async () => {
      await teremock.stop()
      await page.goto('http://localhost:3000')
      const inter = { url: 'nflaiweuhfawejfaiosejfa;sdif' }

      // * Starting mocker with void capture.urls
      await teremock.start({
        page,
        interceptors: {
          __teremock_buildin_capture: inter,
          __teremock_buildin_pass: inter,
        }
      })

      // * Typing `a` → invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('a')

      // * Awaiting for real response and its corresponding reaction (text `suggest: example` must appear)
      await page.waitForFunction(() => {
        // @ts-ignore
        return document.querySelector('#suggest').innerText === '200 example'
      }, { timeout: 4000 })

      // * All connections must resolves after theirs completion
      await expect(teremock.connections()).resolves.toEqual(undefined)
    })

    it('Resolves `stop` even when no requests from capture.urls were made', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void capture.urls
      await teremock.start({ page })

      // * invoking request to `/api`, which is not mocked
      await page.click('#input')
      await page.keyboard.type('a')

      // * Awaiting for real response and its corresponding reaction (text `suggest: example` must appear)
      await page.waitForFunction(() => {
        // @ts-ignore
        return document.querySelector('#suggest').innerText === '200 example'
      }, { timeout: 4000 })

      await expect(teremock.stop()).resolves.toEqual(undefined)
    })

    it('do not change the filename when blacklisted query changes', async () => {
      const interceptor = {
        naming: { query: { blacklist: ['baz'] } }
      }
      const storage = { set: sinon.spy(async () => ''), has: () => false }

      // * Creating mocker with custom storage
      // @ts-ignore
      const teremock = new Teremock({ storage })

      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({
        page,
        interceptors: { basic: interceptor }
      })
      await page.goto('http://localhost:3000')

      // * Making request with query param baz=1
      await page.evaluate(function() { fetch('/api?foo=bar&baz=1') } )
      // @todo await some real effects
      await sleep(99) // need some time to evaluate
      await teremock.connections()
      const firstMockId = (storage.set.getCall(0).args as any[])[0]
      expect(firstMockId.length > 0).toBe(true)

      // * Making request with query param baz=2
      await page.evaluate(function() { fetch('/api?foo=bar&baz=2') } )
      await sleep(99) // need some time to evaluate
      await teremock.connections()
      const secondMockId = (storage.set.getCall(1).args as any[])[0]

      expect(firstMockId).toBe(secondMockId)
      await teremock.stop()
    })

    it('teremock.start() after request was made (no __meta in response)', async () => {
      await page.goto('http://localhost:3000')

      // * invoking GET request to `/api` with 100 ms ttfb
      await page.click('#button')

      // * starting mocker _after_ request was made (but not finished)
      await teremock.start({ page })

      // * check old text in the button (before response)
      const text1 = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text1).toBe('Click to start')

      // * await for response
      await sleep(150)

      // * check the result of response – it must not be blocked
      const text2 = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text2).toBe('200 click')
      await teremock.stop()
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
      // @ts-ignore
      const teremock = new Teremock({ storage })
      await teremock.start({ page, interceptors })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(100)

      // * storage.set must be called, since the request is capturable
      // console.log('storage.set.getCall(0).args[0]', storage.set.getCall(0).args[0])
      expect(storage.set.calledOnce).toBe(true)
      expect((storage.set.getCall(0).args as any[])[0]).toBe('some_name--get-q-click')
      await teremock.stop()
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
      // @ts-ignore
      await teremock.start({ page, storage, interceptors })

      // * Invoking request to `/api`
      await page.click('#button')
      await sleep(200)

      // * storage.has must not be called, since the request is not capturable
      expect(storage.has.called).toBe(false)
      await teremock.stop()
    })

    it('functional interceptor', async () => {
      await page.goto('http://localhost:3000')

      const interceptors = {
        functional: {
          url: '/api',
          response: async (request: Request) => {
            const { query } = parseUrl(request.url)
            return {
              body: { suggest: `${query.q}-${query.q}-${query.q}` }
            }
          }
        }
      }

      // * Starting mocker with wildcard interceptor
      const teremock = new Teremock()
      await teremock.start({ page, interceptors })

      // * Typing `a` → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#input')
      await page.keyboard.type('i')
      await sleep(35)

      const text = await page.evaluate(element => element.textContent, await page.$('#suggest'))

      expect(text).toBe('200 i-i-i')
      await teremock.stop()
    })
  })

  describe('teremock.spy', () => {
    it('teremock.spy simple case', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })
      const spy = teremock.spy({
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
      await teremock.stop()
    })

    it('teremock.spy requests/responseLogs', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })
      const spy = teremock.spy({
        url: 'http://localhost:3000/api',
      })

      // * Clicking button → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#button')
      await sleep(35)
      expect(spy.events.length).toBe(1)
      const { requestOrder, responseOrder } = spy.events[0]
      expect(responseOrder && responseOrder > requestOrder).toBe(true)
      await teremock.stop()
    })

    it('teremock.spy inline mock', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Create inline mock
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest' } }
      })

      // * Creating a spy
      const spy = teremock.spy({
        url: 'http://localhost:3000/api',
      })

      // * Clicking button → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#button')
      await sleep(50)

      expect(spy.called).toBe(true)
      expect(spy.calledOnce).toBe(true)

      await teremock.stop()
    })

    it('teremock.spy formData incorrect', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Creating a spy
      const spy = teremock.spy({
        url: 'http://localhost:3000/api',
        body: {
          foo: 'bar'
        }
      })

      // * Clicking button → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#button-form')
      await sleep(50)

      expect(spy.called).toBe(false)
      expect(spy.calledOnce).toBe(false)

      await teremock.stop()
    })

  it('teremock.spy formData correct', async () => {
    await page.goto('http://localhost:3000')

    // * Starting mocker
    await teremock.start({ page })

    // * Creating a spy
    const spy = teremock.spy({
      url: 'http://localhost:3000/api',
      body: {
        say: 'Hi'
      }
    })

    // * Clicking button → invoking GET request to `/api`, which is mocked with inline mock
    await page.click('#button-form')
    await sleep(50)

    expect(spy.called).toBe(true)
    expect(spy.calledOnce).toBe(true)

    await teremock.stop()
  })
})

  describe('teremock.add', () => {
    it('teremock.add simple case', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Create inline mock
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest' } }
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 teremock.add suggest')
      await teremock.stop()
    })

    it('utf-8 charset', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Create inline mock with cyrillic letters
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'Строчка на русском языке' } }
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 Строчка на русском языке')
      await teremock.stop()
    })

    it('remove handler', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Create inline mock
      const remove = teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest' } }
      })
      remove()

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).not.toBe('200 teremock.add suggest')
      await teremock.stop()
    })

    it('ttfb', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })

      // * Create instant inline mock
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest', ttfb: 0 } },
      })

      // * Invoking GET request to `/api`
      await page.click('#button')

      // * Awaiting less than initial sleep (30 ms), but more than inline mocked sleep (0 ms)
      await sleep(1)
      const text = await page.evaluate(element => element.textContent, await page.$('#button'))
      expect(text).toBe('200 teremock.add suggest')
      await teremock.stop()
    })

    it('race condition', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page })
      teremock.add({
        url: 'http://localhost:3000/api',
        query: { q: 'a' },
        response: {
          body: { suggest: 'custom A' },
          ttfb: 100,
        }
      })

      teremock.add({
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
      await teremock.stop()
    })
  })

  describe('options.response', () => {
    it('ttfb as array', async () => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, responseOverrides: { ttfb: [150, 50] } })
      await teremock.add({ query: { q: 'x' }, response: { body: { suggest: 'x' } } })
      await teremock.add({ query: { q: 'xy' }, response: { body: { suggest: 'xy' } } })

      // * Typing `ab` → invoking two request to `/api`
      await page.click('#input')
      await page.keyboard.type('xy')

      // * Wait for the second request (50 ms) to be done
      await sleep(100)

      // * Suggest must have text from the second request
      const text1 = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text1).toBe('200 xy')

      // * Wait for the first request (150ms) to be done
      await sleep(100)

      // * After the first request is done, text must be just `q`
      const text2 = await page.evaluate(element => element.textContent, await page.$('#suggest'))
      expect(text2).toBe('200 x')
      await teremock.stop()
    })
  })

  describe('options.getMockId', () => {
    it('name as query', async () => {
      rimraf.sync(path.resolve(__dirname, '../__teremocks__/custom-mock-id'))
      const mockFilePath = path.resolve(__dirname, '../__teremocks__/custom-mock-id/w.json')
      await page.goto('http://localhost:3000')
      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Starting mocker
      await teremock.start({
        page,
        getMockId: ({ url }) => {
          const urlObj = new URL(url)
          const query = urlObj.searchParams.get('q')

          return `custom-mock-id--${query}`
        }
      })

      // * Typing `w` → invoking two request to `/api`
      await page.click('#input')
      await page.keyboard.type('w')
      await sleep(200)
      expect(fs.existsSync(mockFilePath)).toBe(true)

      await teremock.stop()
    })
  })
})
