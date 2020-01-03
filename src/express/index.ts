// client side code

import { UserOptions, UserInterceptor } from '../types'

export const DEFAULT_WS_PORT = 27495

class Tes {
  private socket: WebSocket
  private send(method, data) {
    this.socket.send(JSON.stringify({ method, data }))
  }
  private handle(str: string) {
    const { message } = JSON.parse(str)

    switch (message) {
      case 'started':
        this.startResolve()
        break
    }
  }
  private startResolve: () => void
  private startPromise: Promise<void>

  public async start(options: UserOptions & { wsUrl?: string } = {}): Promise<void> {
    const { wsUrl, ...tOptions } = options
    const resultWsUrl = wsUrl ?? `ws://localhost:${DEFAULT_WS_PORT}/path/doesnt/matter`
    let reject: Function
    this.startPromise = new Promise((res, rej) => {
      this.startResolve = res
      reject = rej
    })

    this.socket = new WebSocket(resultWsUrl)

    this.socket.addEventListener('open', (_event) => {
      console.log('WebSocket connection opened', resultWsUrl)
      this.send('start', tOptions)
    })

    this.socket.addEventListener('message', (event) => {
      console.log('message', event.data)
      this.handle(event.data)
    })

    this.socket.addEventListener('error', (event) => {
      console.log('WebSocket connection failed', event)
      reject()
    })

    return this.startPromise
  }

  public async add(userInterceptor: UserInterceptor) {
    await this.startPromise
    this.socket.send(JSON.stringify({ method: 'add', data: userInterceptor }))

    return () => {
      this.socket.send(JSON.stringify({ method: 'remove', data: userInterceptor }))
    }
  }

  public async stop() {
    await this.startPromise
    this.socket.send(JSON.stringify({ method: 'stop' }))
    this.socket.close()
  }
}

export default new Tes()
