const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')
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

app.listen(3000, () => signale.debug('http://localhost:3000'))

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    signale.debug('received: %s', message)
    ws.send(`Hello, you sent -> ${message}`)
  })

  ws.send('Hi there, I am a WebSocket server')
})

server.listen(4000, () => signale.debug('ws://localhost:4000'));
