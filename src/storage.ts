import fs from 'fs'
import path from 'path'
import { URL } from 'url'
import makeDir from 'make-dir'
import debug from 'debug'
import signale from './logger'
import getRequestId from './getRequestId'
import logger from './logger'

const loggerRead = debug('prm:storage:read')
const loggerWrite = debug('prm:storage:write')

const loggerNames = debug('prm:storage:names')

const getNames = (params) => {
  const { hostname, pathname, protocol } = new URL(params.url)

  loggerNames(`Url parts are hostname=${hostname}, pathname=${pathname}, protocol=${protocol}`)

  const dirName = pathname.replace(/\//g, '-').replace(/^-|-$/g, '')

  loggerNames(`dirName=${dirName} wd=${params.wd}`)

  const targetDir = path.join(params.wd, `${hostname}${dirName ? '-' + dirName : ''}`)

  loggerNames(`targetDir=${targetDir}`)

  const fileName = getRequestId(params)

  loggerNames(`fileName=${fileName}`)

  const absFileName = path.join(targetDir, fileName)

  loggerNames(`absFileName=${absFileName}`)

  return {
    targetDir,
    absFileName,
  }
}

export const write = ({ fn, body, url, ci }) => {
  loggerWrite(`Entering storage.write with fn === ${fn}`)

  const jsonFn = fn + '.json'
  const targetDir = path.dirname(fn)

  return makeDir(targetDir).then(() => {
    loggerWrite(`Successfully checked/created targetDir ${targetDir}`)

    return new Promise((resolve, reject) => {
      let fileExists = fs.existsSync(jsonFn)

      if (!fileExists) {
        fileExists = fs.existsSync(fn)
      }

      if (!fileExists) {
        loggerWrite(`File does not exists ${fn}`)

        if (ci) {
          loggerWrite(`Url "${url}" wasnt mocked! Rejecting and exiting storage.write.`)
          reject(Error(`Mock cannot be saved in CI mode.`))

          return
        }

        signale.write(`Writing mock for url "${url}"`)
        signale.write(`to file "${jsonFn}"`)

        fs.writeFile(jsonFn, body, (err) => {
          if (err) {
            signale.error(`Failed to write new file ${jsonFn}`)

            reject(err)
          }

          signale.success(`Successfully wrote new file ${jsonFn}`)

          resolve({ fn, new: true })
        })
      } else {
        loggerWrite(`File already exists, do nothing ${fn}`)

        resolve({ fn, new: false })
      }
    })
  })
}

export const read = (fn) => {
  loggerRead(`About to read file ${fn}(.json)`)
  const jsonFn = fn + '.json'
  let fileToRead = jsonFn

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(jsonFn)) {
      loggerRead(`json version of the mock does not exists, trying to read ${fn}`)
      fileToRead = fn
    }

    try {
      fs.readFile(fileToRead, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            loggerRead(`File does not exist ${fileToRead}`)
          } else {
            logger.error(`Fail to read the file ${fileToRead}`, err)
          }

          reject({ fn, err })
        } else {
          logger.read(`Successfully read the file ${fileToRead}`)

          resolve(data)
        }
      })
    } catch (err) {
      logger.error(`Unexpected failure of file reading ${fileToRead}`, err)

      reject({ fn, err })
    }
  })
}

export const __getNames = getNames
// @ts-ignore
export const name = (...args) => getNames(...args).absFileName
