import { Signale } from 'signale'
import debug from 'debug'

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
      badge: '»',
      color: 'blue',
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

const loggersMap = {}

export function debug(key) {
  if (!loggersMap[key]) {
    loggersMap[key] = debug(key)
  }

  return loggersMap[key]
}
