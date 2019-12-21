const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const signale = require('signale')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const htmlPath = path.resolve(__dirname, './index.html')
const htmlContent = fs.readFileSync(htmlPath, 'utf8')

app.get('/', (req, res) => {
  signale.info(`entering /`)

  res.send(htmlContent)
})

app.post('/form-submit', (req, res) => {
  signale.info(`get /api`, req.body)

  res.send(`Submitted with form-data: ${JSON.stringify(req.body, null, '  ')}`)
})

app.listen(3000, () => signale.info('http://localhost:3000'))
