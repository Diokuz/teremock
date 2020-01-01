const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const logger = require('./logger')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const suggests = {
  a: 'example',
  ab: 'world',
  abc: 'green',
  abcd: 'book',
}

app.get('/api', (req, res) => {
  const q = req.query.q

  setTimeout(() => {
    res.set('Access-Control-Allow-Origin', '*')
    res.json({ suggest: suggests[q] || q })
  }, 30)
})

app.post('/api', (req, res) => {
  const q = req.body.q

  setTimeout(() => {
    res.set('Access-Control-Allow-Origin', '*')
    res.json({ suggest: suggests[q] || q })
  }, 100)
})

app.post('/cors-api', (req, res) => {
  const q = req.query.q

  setTimeout(() => {
    res.set('Access-Control-Allow-Origin', '*')
    res.json({ suggest: suggests[q] || q })
  }, 100)
})

app.get('/', (req, res) => {
  try {
    const htmlPath = path.resolve(__dirname, './index.html')
    const htmlContent = fs.readFileSync(htmlPath, 'utf8')

    res.send(htmlContent)
  } catch (e) {
    logger.fatal(e.message)
    res.send('not ok')
  }
})

app.get('/text', (req, res) => {
  res.send('<div id="text">text</div>')
})

app.listen(3000, () => logger.info('http://localhost:3000'))
app.listen(4000, () => logger.info('http://localhost:4000'))
