import { Signale } from 'signale'

let logLevel = process.env.SIGNALE_LOG_LEVEL || 'debug'

const options = {
  disabled: false,
  interactive: false,
  logLevel,
  scope: 'teremock',
  secrets: [],
  stream: process.stdout,
  types: {
    debug: {
      badge: '»',
      color: 'grey',
      label: 'debug',
      logLevel: 'info',
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
