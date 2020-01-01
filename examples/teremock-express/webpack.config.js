const path = require('path')

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, 'client.js'),
  output: { path: __dirname, filename: 'bundle.js' },

  // If you want to change `wd` from tests
  node: {
    __dirname: true,
  },

  devtool: false,
}
