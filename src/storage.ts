import { promises as fs } from 'fs'
import path from 'path'
import makeDir from 'make-dir'
import debug from 'debug'
import signale from './logger'

const loggerGet = debug('teremock:storage:get')
const loggerSet = debug('teremock:storage:set')
const loggerHas = debug('teremock:storage:has')

export const getFileName = ({ wd, mockId }: { wd: string; mockId: string }): string => {
  return path.resolve(wd, mockId.replace('--', path.sep) + '.json')
}

type Params = {
  ci: boolean,
  wd: string,
}

type Opts = {
  wd?: string
}

type Json = {
  request: {
    url: string,
  },
  response: any,
}

type GetRet = {
  request: Request
  response: Response
}

export default class Storage {
  private wd: string

  constructor({ wd }: Params) {
    this.wd = wd
  }

  async set(mockId: string, json: Json, opts?: Opts): Promise<void> {
    loggerSet(`entering storage.set with mockId "${mockId}"`)

    const wd = opts?.wd ?? this.wd
    const absFileName = getFileName({ mockId, wd })
    const targetDir = path.dirname(absFileName)
    const content = JSON.stringify(json, null, '  ')

    await makeDir(targetDir)

    loggerSet(`successfully checked/created targetDir ${targetDir}`)

    if (await this.has(mockId)) {
      loggerSet(`file already exists, overwriting ${mockId}`)
    }

    signale.set(`writing mock for url "${json?.request?.url}"`)
    signale.set(`to file "${absFileName}"`)

    try {
      await fs.writeFile(absFileName, content)
      signale.success(`successfully wrote new file ${absFileName}`)
    } catch (e) {
      signale.error(`failed to write new file ${absFileName}`)
      throw e
    }
  }

  // only for tests
  _getFn(mockId, opts?: Opts): string {
    const wd = opts?.wd ?? this.wd
    return getFileName({ mockId, wd })
  }

  async get(mockId: string, opts?: Opts): Promise<GetRet> {
    const absFileName = this._getFn(mockId, opts)

    loggerGet(`about to read file ${absFileName}`)

    try {
      const data = JSON.parse(await fs.readFile(absFileName, 'utf8'))
      loggerGet(`successfully read the file ${absFileName}`)
      return data
    } catch (err) {
      if (err.code === 'ENOENT') {
        loggerGet(`fail to read the file (ENOENT) ${absFileName}`, err.message)
      } else {
        signale.error(`fail to read the file ${absFileName} for some other reason`, err)
      }

      throw err
    }
  }

  async has(mockId: string, opts?: Opts): Promise<boolean> {
    const absFileName = this._getFn(mockId, opts)

    loggerHas(`about to check file ${absFileName}`)

    let fileExists = false

    try {
      await fs.access(absFileName)

      fileExists = true
      loggerHas(`file "${absFileName}" exists`)
    } catch (e) {
      loggerHas(`file "${absFileName}" does not exists`)
    }

    return fileExists
  }
}
