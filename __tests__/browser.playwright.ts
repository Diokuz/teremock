
// typescript types
import 'jest-playwright-preset'

import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import { Teremock, PlaywrightDriver } from '../src'
import { setup as setupDevServer, teardown as teardownDevServer } from 'jest-process-manager'

async function sleep(time: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

describe('teremock playwright', () => {
  let teremock: Teremock

  beforeAll(async () => {
    const serverPath = path.resolve(__dirname, 'server')

    await setupDevServer({
      command: `node ${serverPath}`,
      port: 3000,
      usedPortAction: 'kill',
    })
  })

  afterAll(async () => {
    await teardownDevServer()
  })

  describe('basic', () => {
    beforeEach(async () => {
      teremock = new Teremock({ driver: new PlaywrightDriver({ page }) })
      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({
        page,
        wd: path.resolve(process.cwd(), '__teremocks-playwright__')
      })
    })

    afterEach(async () => {
      await teremock.stop()
    })

    it('generates mocks', async () => {
      const mockFilePath = path.resolve(__dirname, '../__teremocks-playwright__/localhost-api/get-q-abcd.json')

      rimraf.sync(path.resolve(__dirname, '../__teremocks-playwright__'))
      await page.goto('http://localhost:3000')

      expect(fs.existsSync(mockFilePath)).toBe(false)

      // * Typing `abcd` → invoking request to `/api`
      await page.click('#input')
      await page.keyboard.type('abcd', { delay: 100 })

      // @todo fix connections and write tests already!
      await sleep(500)

      // * At that point there must be mock files
      expect(fs.existsSync(mockFilePath)).toBe(true)
    })
  })

  describe('async', () => {
    it('should handle interceptor\'s async response', async () => {
      teremock = new Teremock({ driver: new PlaywrightDriver({ page }) })
      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({
        page,
        wd: path.resolve(process.cwd(), '__teremocks-playwright__'),
        interceptors: {
          asyncApi: {
            url: 'api',
            response: async (req) => {
              await sleep(150)
              return {
                status: 200,
                headers: {},
                body: req.query,
              }
            },
          }
        },
        awaitConnectionsOnStop: false,
      })
      await page.goto('http://localhost:3000')
      await page.click('#button')

      await teremock.stop()
    })
  })
})
