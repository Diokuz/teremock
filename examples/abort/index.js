const fs = require('fs')
const path = require('path')
const express = require('express')
const signale = require('signale')

const app = express()

const htmlPath = path.resolve(__dirname, './index.html')
const htmlContent = fs.readFileSync(htmlPath, 'utf8')

app.get('/', (req, res) => {
  signale.info(`entering /`)

  res.send(htmlContent)
})

app.get('/api', (req, res) => {
  signale.info(`get /api`)

  res.send(`ok`)
})

app.listen(3000, () => signale.info('http://localhost:3000'))
