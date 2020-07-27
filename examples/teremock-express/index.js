const express = require('express')
// const teremock = require('../../dist/express').default
const tes = require('../../express/server').default

const app = express()

app.use(express.static(__dirname))

app.get('/real-api', (req, res) => {
  res.json({ suggest: req.query.q })
})

app.get('/real-notfound', (req, res) => {
  res.status(404).json({ suggest: 'see other' })
})

app.listen(3000, () => console.log('http://localhost:3000'))
app.listen(4000, () => console.log('http://localhost:4000'))

// will create `app.get('/api')` route, which will proxy requests to real-api
tes.listen({
  app,
  env: { api: 'http://localhost:4000/real-api', notfound: 'http://localhost:4000/real-notfound' },
})
