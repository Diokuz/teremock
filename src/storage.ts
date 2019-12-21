import fs from 'fs'
import path from 'path'
import makeDir from 'make-dir'
import debug from 'debug'
import signale from './logger'

const loggerGet = debug('teremock:storage:get')
const loggerSet = debug('teremock:storage:set')

export const getFileName = ({ wd, mockId }: { wd: string; mockId: string }) => {
  return path.resolve(wd, mockId.replace('--', path.sep) + '.json')
}

const set = (mockId: string, { body, url, ci }, { wd }: { wd: string }) => {
  const absFileName = getFileName({ mockId, wd })
  loggerSet(`Entering storage.set with fn === ${mockId}`)
  const targetDir = path.dirname(absFileName)

  return makeDir(targetDir).then(() => {
    loggerSet(`Successfully checked/created targetDir ${targetDir}`)

    return new Promise((resolve, reject) => {
      let fileExists = fs.existsSync(absFileName)

      if (!fileExists) {
        fileExists = fs.existsSync(mockId)
      }

      if (!fileExists) {
        loggerSet(`File does not exists ${mockId}`)

        if (ci) {
          loggerSet(`Url "${url}" wasnt mocked! Rejecting and exiting storage.set.`)
          reject(Error(`Mock cannot be saved in CI mode.`))

          return
        }

        signale.set(`Writing mock for url "${url}"`)
        signale.set(`to file "${absFileName}"`)

        fs.writeFile(absFileName, body, (err) => {
          if (err) {
            signale.error(`Failed to write new file ${absFileName}`)

            reject(err)
          }

          signale.success(`Successfully wrote new file ${absFileName}`)

          resolve({ mockId, new: true })
        })
      } else {
        loggerSet(`File already exists, do nothing ${mockId}`)

        resolve({ mockId, new: false })
      }
    })
  })
}

const get = (mockId: string, { wd }: { wd: string }) => {
  const absFileName = getFileName({ mockId, wd })

  loggerGet(`about to read file ${absFileName}`)

  return new Promise((resolve, reject) => {
    try {
      fs.readFile(absFileName, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            loggerGet(`File does not exist ${absFileName}`)
          } else {
            signale.error(`Fail to read the file ${absFileName}`, err)
          }

          reject({ mockId, err })
        } else {
          signale.get(`successfully read the file ${absFileName}`)

          resolve(data)
        }
      })
    } catch (err) {
      signale.error(`unexpected failure of file reading ${absFileName}`, err)

      reject({ mockId, err })
    }
  })
}

export default {
  set,
  get,
}
