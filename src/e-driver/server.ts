import express from 'express'
import WebSocket from 'ws'
import http from 'http'
import logger from '../logger'
import { UserOptions } from '../types'
import { DEFAULT_WS_PORT } from './index'
import ExpressDriver from './driver'
import { Teremock } from '..'

type ExpressUserOptions = UserOptions & {
  app: express.Application
  env: Record<string, string>
}

export class ExpressTeremock extends Teremock {
  async start(opts: ExpressUserOptions) {
    const { app, env, ...rest } = opts

    this.driver = this.driver ?? new ExpressDriver({ app, env })

    return await super.start(rest)
  }
}

const expressTeremock = new ExpressTeremock()

type Opts = {
  app?: express.Application
  port?: number
  getMockId?: (arg: any) => string
  env: Record<string, string>
  wd?: string
}

const tes = {
  listen(opts: Opts = { env: {} }) {
    const app = opts.app ?? express()
    const env = opts.env
    const wd = opts.wd
    const port = opts.port ?? DEFAULT_WS_PORT
    const server = http.createServer(app)
    const wss = new WebSocket.Server({ server })

    wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (message: string) => {
        const { method, data } = JSON.parse(message)
        console.log('data', data)
        console.log('message', message)

        switch (method) {
          case 'start':
            await expressTeremock.start({ wd, ...data, app, env, getMockId: opts.getMockId })
            ws.send(JSON.stringify({ message: 'started' }))
            break
          case 'add':
            await expressTeremock.add(data)
            ws.send(JSON.stringify({ message: 'added' }))
            break
          case 'remove':
            await expressTeremock.remove(data)
            ws.send(JSON.stringify({ message: 'removed' }))
            break
          case 'stop':
            await expressTeremock.stop(data)
            // ws.send(JSON.stringify({ message: 'stopped' }))
            break
        }
      })

      logger.info(`Client connected on ${port}`)
    })

    server.listen(port, () => {
      logger.info(`WebSocket start to listen on ${port}`)
    })
  },
}

export default tes
