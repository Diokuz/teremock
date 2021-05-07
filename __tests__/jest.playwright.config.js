module.exports = {
  testMatch: [
    '**/__tests__/**/*.playwright.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist/'
  ],

  transform: {
    '\\.tsx?$': 'ts-jest',
  },

  preset: 'jest-playwright-preset',

  testEnvironmentOptions: {
    'jest-playwright': {
      browsers: ['chromium', 'firefox', 'webkit'],
    },
  },
}
