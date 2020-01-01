import { promises as fs } from 'fs'
import path from 'path'
import makeDir from 'make-dir'
import debug from 'debug'
import signale from './logger'
import { Storage, Request, Response } from './types'

const loggerGet = debug('teremock:storage:get')
const loggerSet = debug('teremock:storage:set')
const loggerHas = debug('teremock:storage:has')

export const getFileName = ({ wd, mockId }: { wd: string; mockId: string }): string => {
  return path.resolve(wd, mockId.replace('--', path.sep) + '.json')
}

type ConstructParams = {
  wd: string,
}

type Json = {
  request: Request,
  response: Response,
}

type GetRet = {
  request: Request
  response: Response
}

export default class FileStorage implements Storage {
  private wd: string

  constructor(params?: ConstructParams) {
    this.wd = params?.wd ?? path.resolve(process.cwd(), '__teremocks__')
  }

  async set(mockId: string, json: Json): Promise<void> {
    loggerSet(`entering storage.set with mockId "${mockId}"`)

    const absFileName = getFileName({ mockId, wd: this.wd })
    const targetDir = path.dirname(absFileName)
    const content = JSON.stringify(json, null, '  ')

    await makeDir(targetDir)

    loggerSet(`successfully checked/created targetDir ${targetDir}`)

    if (await this.has(mockId)) {
      loggerSet(`file already exists, overwriting ${mockId}`)
    }

    signale.set(`writing mock for mockId "${mockId}", url "${json?.request?.url}"`)
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
  _getFn(mockId): string {
    return getFileName({ mockId, wd: this.wd })
  }

  async get(mockId: string): Promise<GetRet> {
    const absFileName = this._getFn(mockId)

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

  async has(mockId: string): Promise<boolean> {
    const absFileName = this._getFn(mockId)

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

  setWd(nextWd: string | string[]): string {
    this.wd = typeof nextWd === 'string' ? nextWd : path.join(process.cwd(), ...nextWd)

    return this.wd
  }
}
