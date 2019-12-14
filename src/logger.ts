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
    read: {
      badge: '»',
      color: 'gray',
      label: 'read',
      logLevel: 'info',
    },
    write: {
      badge: 'œ',
      color: 'red',
      label: 'write',
      logLevel: 'warn',
    },
  },
}

const logger = new Signale(options)

export default logger
