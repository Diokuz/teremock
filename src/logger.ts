import { Signale } from 'signale'
import nativeDebug from 'debug'

let logLevel = process.env.DEBUG_LL || 'info'
let resultLogLevel = 'debug'

if (logLevel === 'debug') {
  resultLogLevel = 'info'
}

if (logLevel === 'info') {
  resultLogLevel = 'debug'
}

const options = {
  disabled: false,
  interactive: false,
  logLevel: resultLogLevel,
  scope: 'teremock',
  secrets: [],
  stream: process.stdout,
  types: {
    debug: {
      badge: '•',
      color: 'grey',
      label: 'debug',
      logLevel: 'info',
    },
    info: {
      badge: 'ø',
      color: 'green',
      label: 'info',
      logLevel: 'debug',
    },
    get: {
      badge: '»',
      color: 'gray',
      label: 'storage.get',
      logLevel: 'info',
    },
    set: {
      badge: 'œ',
      color: 'red',
      label: 'storage.set',
      logLevel: 'warn',
    },
  },
}

const logger = new Signale(options)

export default logger

const loggersMap: Record<string, ReturnType<typeof nativeDebug>> = {}

export function debug(key: string) {
  if (!loggersMap[key]) {
    loggersMap[key] = nativeDebug(key)
  }

  return loggersMap[key]
}
