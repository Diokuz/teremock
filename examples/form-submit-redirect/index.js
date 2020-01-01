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

app.get('/after-submit-page', (req, res) => {
  signale.info(`entering /after-submit-page`)

  res.send('TADA!')
})

/**
 * Redirection route is disabled, but redirection works, because of mocks.
 */

// app.post('/form-submit', (req, res) => {
//   res.redirect(301, `/after-submit-page?firstname=${req.body.firstname}`)
// })

app.listen(3000, () => signale.info('http://localhost:3000'))
