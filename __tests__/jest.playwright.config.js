module.exports = {
  testMatch: [
    '**/__tests__/**/*.playwright.ts',
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
