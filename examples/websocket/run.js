const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer')
const waitPort = require('wait-port')
const rimraf = require('rimraf')
const signale = require('signale')
const mocker = require('../../').default

async function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}

const mocksDir = path.resolve(__dirname, '__teremocks__')
let page
let server
let browser

async function before() {
  rimraf.sync(mocksDir)

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
  });
  await waitPort({ host: 'localhost', port: 3000 })
}

async function after() {
  await browser.close()
  process.kill(-server.pid)
}

async function run() {
  await before()

  await page.goto('http://localhost:3000')
  await mocker.start({ page, wd: mocksDir })

  await sleep(99999)
  await page.click('button')

  await mocker.stop()
  await after()
}

run()
