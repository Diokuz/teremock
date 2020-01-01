const fs = require('fs')
const path = require('path')
const express = require('express')
const teremock = require('../../dist/express').default

const app = express()

app.use(express.static(__dirname))

app.get('/real-api', (req, res) => {
  res.json({ suggest: req.query.q })
})

app.listen(3000, () => console.log('http://localhost:3000'))
app.listen(4000, () => console.log('http://localhost:4000'))

// will create `app.get('/api')` route, which will proxy requests to real-api
teremock.start({
  app,
  env: { api: 'http://localhost:4000/real-api' },
  wd: path.resolve(__dirname, '__teremocks__'),
})
