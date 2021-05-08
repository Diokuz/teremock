module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  testMatch: [
    '**/__tests__/**/*.spec.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist/'
  ]
}
