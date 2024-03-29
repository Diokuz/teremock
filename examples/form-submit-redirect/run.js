const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer')
const waitPort = require('wait-port')
const signale = require('signale')
const mocker = require('../../').default

const mocksDir = path.resolve(__dirname, '__teremocks__')
let page
let server
let browser

async function before() {
  const serverPath = path.resolve(__dirname, 'index.js')
  browser = await puppeteer.launch(process.env.D ? {
    headless: false,
    slowMo: 80,
    devtools: true,
  } : {})

  page = await browser.newPage()
  // Cant kill if detached: false (for reasons unknown)
  // Probably https://azimi.me/2014/12/31/kill-child_process-node-js.html
  server = spawn('node', [serverPath], { detached: true })
  server.stdout.on('data', function(data) {
    signale.info(data.toString())
  })
  await waitPort({ host: 'localhost', port: 3000 })
}

async function after() {
  await browser.close()
  process.kill(-server.pid)
}

async function run() {
  const navigationInterceptor = {
    url: '/form-submit',
    resourceTypes: 'document'
  }

  await before()
  await mocker.start({ page, wd: mocksDir, interceptors: { navigationInterceptor } })
  await page.goto('http://localhost:3000')
  await page.click('input[name="firstname"]')
  await page.keyboard.type('Firstname', { delay: 100 })
  await page.click('input[name="lastname"]')
  await page.keyboard.type('Lastname', { delay: 100 })
  await page.click('#submit')
  await mocker.connections()
  await mocker.stop()
  await after()
}

run().catch((e) => {
  process.exitCode = 1
  console.error(e.message)
  process.kill(-server.pid)
})
