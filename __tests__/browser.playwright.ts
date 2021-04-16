
// typescript types
import 'jest-playwright-preset'

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import rimraf from 'rimraf'
import signale from 'signale'
import waitPort from 'wait-port'
import { Teremock, PlaywrightDriver } from '../src'

async function sleep(time) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

let server

describe('teremock playwright', () => {
  let teremock

  beforeAll(async () => {
    teremock = new Teremock({ driver: new PlaywrightDriver({ page }) })

    const serverPath = path.resolve(__dirname, 'server')

    // Cant kill if detached: false (for reasons unknown)
    // Probably https://azimi.me/2014/12/31/kill-child_process-node-js.html
    server = spawn('node', [serverPath], { detached: true })
    server.stdout.on('data', function(data) {
      signale.info(data.toString())
      // process.stdout.write(data.toString())
    });
    await waitPort({ host: 'localhost', port: 3000 })
  })

  describe('basic', () => {
    it('generates mocks', async () => {
      const mockFilePath = path.resolve(__dirname, '../__teremocks-playwright__/localhost-api/get-q-abcd.json')

      rimraf.sync(path.resolve(__dirname, '../__teremocks-playwright__'))

      // * Starting mocker - no matter when, because only xhr/fetch requestTypes intercepted by default
      await teremock.start({
        page,
        wd: path.resolve(process.cwd(), '__teremocks-playwright__')
      })
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
})

process.on('exit', () => {
  process.kill(-server.pid)
})
