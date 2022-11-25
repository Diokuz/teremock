import fs from 'fs'
import path from 'path'
import { expect, test as base } from '@playwright/test'
import rimraf from 'rimraf'
import sinon from 'sinon'
import { Teremock, parseUrl } from '../index'

import type { Request } from '../src/types'

async function sleep(time: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

const test = base.extend<{ teremock: Teremock }, { cleanup: void }>({
  teremock: async ({ page }, use) => {
    const teremock = new Teremock()
    await use(teremock)
    await teremock.stop()
  },

  cleanup: [async ({}, use) => {
    rimraf.sync(path.resolve(process.cwd(), '__teremocks__'))
    rimraf.sync(path.resolve(process.cwd(), '__teremocks-post__'))
    // rimraf.sync(path.resolve(__dirname, '../__teremocks-post__'))
    await use()
  }, { scope: 'worker', auto: true }]
})

test('generates mocks', async ({ page, teremock }) => {
  const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-q-abcd.json')

  await page.goto('http://localhost:3000')
  await teremock.start({ page, ci: false })

  expect(fs.existsSync(mockFilePath)).toBe(false)

  // * Typing `abcd` → invoking request to `/api`
  await page.locator('#input').type('abcd', { delay: 100 })

  // * At that point there must be mock files
  await expect.poll(() => fs.existsSync(mockFilePath)).toBe(true)
})

test('generates mocks to utf-8', async ({ page, teremock }) => {
  const mockFilePath = path.resolve(__dirname, '../__teremocks__/localhost-api/get-bark-seven-emma.json')

  await page.goto('http://localhost:3000')
  await teremock.start({ page, ci: false })

  expect(fs.existsSync(mockFilePath)).toBe(false)

  await page.locator('#input').type('фt', { delay: 100 })

  await expect.poll(() => fs.existsSync(mockFilePath)).toBe(true)
  expect(JSON.parse(fs.readFileSync(mockFilePath, { encoding: 'utf-8' })).response.body.suggest).toBe('фt')
})

test('generates mocks for POST request', async ({ page, teremock }) => {
  const mockFilePath = path.resolve(__dirname, '../__teremocks-post__/localhost-api/post-jupiter-kitten-iowa.json')

  await page.goto('http://localhost:3000')

  // * Starting mocker
  await teremock.start({
    page,
    wd: '__teremocks-post__',
  })

  expect(fs.existsSync(mockFilePath)).toBe(false)

  // * Typing `abcd` → invoking POST request to `/api`
  await page.locator('#input-post').type('abcd', { delay: 100 })

  // * At that point there must be mock files
  expect(fs.existsSync(mockFilePath)).toBe(true)
})

test('uses existing mocks', async ({ page, teremock }) => {
  await page.goto('http://localhost:3000')

  // * Starting mocker
  await teremock.start({ page, ci: false })

  // * Typing `a` → invoking request to `/api`, which are mocked
  await page.click('#input')
  await page.keyboard.type('a')

  // * Checking suggest in the div
  await sleep(100)
  const text = await page.evaluate(element => element?.textContent, await page.$('#suggest'))
  expect(text).toBe('200 example')
})

test.describe('teremock puppeteer', async () => {

  test.describe('basic', async () => {








//     it.skip('Resolves `connections` even when no requests from capture.urls were made', async ({ page }) => {
//       await teremock.stop()
//       await page.goto('http://localhost:3000')
//       const inter = { url: 'nflaiweuhfawejfaiosejfa;sdif' }

//       // * Starting mocker with void capture.urls
//       await teremock.start({
//         page,
//         interceptors: {
//           __teremock_buildin_capture: inter,
//           __teremock_buildin_pass: inter,
//         }
//       })

//       // * Typing `a` → invoking request to `/api`, which is not mocked
//       await page.click('#input')
//       await page.keyboard.type('a')

//       // * Awaiting for real response and its corresponding reaction (text `suggest: example` must appear)
//       await page.waitForFunction(() => {
//         // @ts-ignore
//         return document.querySelector('#suggest').innerText === '200 example'
//       }, { timeout: 4000 })

//       // * All connections must resolves after theirs completion
//       await expect(teremock.connections()).resolves.toEqual(undefined)
//     })

    test('Resolves `stop` even when no requests from capture.urls were made', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker with void capture.urls
      await teremock.start({ page, ci: false })

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

    test('do not change the filename when blacklisted query changes', async ({ page }) => {
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
        ci: false,
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

    test('teremock.start() after request was made (no __meta in response)', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * invoking GET request to `/api` with 100 ms ttfb
      await page.click('#button')

      // * starting mocker _after_ request was made (but not finished)
      await teremock.start({ page, ci: false })

      // * check old text in the button (before response)
      const text1 = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text1).toBe('Click to start')

      // * await for response
      await sleep(150)

      // * check the result of response – it must not be blocked
      const text2 = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text2).toBe('200 click')
      await teremock.stop()
    })
  })

  test.describe('options.interceptors', async () => {
    test('capture GET request for /api', async ({ page }) => {
      await page.goto('http://localhost:3000')

      // Custom storage for spying (fs wont be used)
      const storage = { set: sinon.spy(async () => ''), has: () => false }
      const interceptors = {
        some_name: { url: '/api' }
      }

      // * Starting mocker with wildcard interceptor
      // @ts-ignore
      const teremock = new Teremock({ storage })
      await teremock.start({ page, interceptors, ci: false })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(100)

      // * storage.set must be called, since the request is capturable
      // console.log('storage.set.getCall(0).args[0]', storage.set.getCall(0).args[0])
      expect(storage.set.calledOnce).toBe(true)
      expect((storage.set.getCall(0).args as any[])[0]).toBe('some_name--get-q-click')
      await teremock.stop()
    })

    test('dont capture GET request for /api when methods are ["post"]', async ({ page, teremock }) => {
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
      await teremock.start({ page, storage, interceptors, ci: false })

      // * Invoking request to `/api`
      await page.click('#button')
      await sleep(200)

      // * storage.has must not be called, since the request is not capturable
      expect(storage.has.called).toBe(false)
    })

    test('functional interceptor', async ({ page }) => {
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
      await teremock.start({ page, interceptors, ci: false })

      // * Typing `a` → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#input')
      await page.keyboard.type('i')
      await sleep(35)

      const text = await page.evaluate(element => element?.textContent, await page.$('#suggest'))

      expect(text).toBe('200 i-i-i')
      await teremock.stop()
    })
  })

  test.describe('teremock.spy', async () => {
    test('teremock.spy simple case', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })
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
      const text = await page.evaluate(element => element?.textContent, await page.$('#suggest'))

      expect(text).toBe('200 world')
    })

    test('teremock.spy requests/responseLogs', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })
      const spy = teremock.spy({
        url: 'http://localhost:3000/api',
      })

      // * Clicking button → invoking GET request to `/api`, which is mocked with inline mock
      await page.click('#button')
      await sleep(35)
      expect(spy.events.length).toBe(1)
      const { requestOrder, responseOrder } = spy.events[0]
      expect(responseOrder && responseOrder > requestOrder).toBe(true)
    })

    test('teremock.spy inline mock', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

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
    })

    test('teremock.spy formData incorrect', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

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
    })

    test('teremock.spy formData correct', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

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
    })
  })

  test.describe('teremock.add', async () => {
    test('teremock.add simple case', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

      // * Create inline mock
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest' } }
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text).toBe('200 teremock.add suggest')
    })

    test('utf-8 charset', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

      // * Create inline mock with cyrillic letters
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'Строчка на русском языке' } }
      })

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text).toBe('200 Строчка на русском языке')
    })

    test('remove handler', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

      // * Create inline mock
      const remove = teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest' } }
      })
      remove()

      // * Invoking GET request to `/api`
      await page.click('#button')
      await sleep(50)

      const text = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text).not.toBe('200 teremock.add suggest')
    })

    test('ttfb', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })

      // * Create instant inline mock
      teremock.add({
        url: 'http://localhost:3000/api',
        response: { body: { suggest: 'teremock.add suggest', ttfb: 0 } },
      })

      // * Invoking GET request to `/api`
      await page.click('#button')

      // * Awaiting less than initial sleep (30 ms), but more than inline mocked sleep (0 ms)
      await sleep(1)
      const text = await page.evaluate(element => element?.textContent, await page.$('#button'))
      expect(text).toBe('200 teremock.add suggest')
    })

    test('race condition', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, ci: false })
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
      const text1 = await page.evaluate(element => element?.textContent, await page.$('#suggest'))
      expect(text1).toBe('200 custom AB')

      // * Waiting for the first response – it will overwrite the result of the second response
      // * because of race condition
      await sleep(150)
      const text2 = await page.evaluate(element => element?.textContent, await page.$('#suggest'))
      expect(text2).toBe('200 custom A')
    })
  })

  test.describe('options.response', async () => {
    test('ttfb as array', async ({ page, teremock }) => {
      await page.goto('http://localhost:3000')

      // * Starting mocker
      await teremock.start({ page, responseOverrides: { ttfb: [150, 50] }, ci: false })
      await teremock.add({ query: { q: 'x' }, response: { body: { suggest: 'x' } } })
      await teremock.add({ query: { q: 'xy' }, response: { body: { suggest: 'xy' } } })

      // * Typing `ab` → invoking two request to `/api`
      await page.click('#input')
      await page.keyboard.type('xy')

      // * Wait for the second request (50 ms) to be done
      await sleep(100)

      // * Suggest must have text from the second request
      const text1 = await page.evaluate(element => element?.textContent, await page.$('#suggest'))
      expect(text1).toBe('200 xy')

      // * Wait for the first request (150ms) to be done
      await sleep(100)

      // * After the first request is done, text must be just `q`
      const text2 = await page.evaluate(element => element?.textContent, await page.$('#suggest'))
      expect(text2).toBe('200 x')
    })
  })

  test.describe('options.getMockId', async () => {
    test('name as query', async ({ page, teremock }) => {
      rimraf.sync(path.resolve(__dirname, '../__teremocks__/custom-mock-id'))
      const mockFilePath = path.resolve(__dirname, '../__teremocks__/custom-mock-id/w.json')
      await page.goto('http://localhost:3000')
      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Starting mocker
      await teremock.start({
        page,
        ci: false,
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
    })
  })
})
