import ExpressDriver from './driver'
import Teremock from '../teremock'
import { UserOptions } from '../types'

type ExpressUserOptions = UserOptions & {
  app: any
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

export default expressTeremock
