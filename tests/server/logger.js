const { Signale } = require('signale')

const options = {
  disabled: false,
  interactive: false,
  logLevel: process.env.SIGNALE_LOG_LEVEL || 'debug',
  scope: 'tests express server',
  secrets: [],
  stream: process.stdout,
  types: {
    req: {
      badge: '»',
      color: 'yellow',
      label: 'req',
      logLevel: 'info',
    },
    res: {
      badge: '«',
      color: 'yellow',
      label: 'res',
      logLevel: 'info',
    },
    log: {
      badge: '🎅',
      color: 'red',
      label: 'santa',
      logLevel: 'debug',
    },
  },
}

const logger = new Signale(options)

module.exports = logger
