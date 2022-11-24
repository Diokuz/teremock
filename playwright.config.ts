/**
 * https://playwright.dev/docs/test-configuration
 */

import { PlaywrightTestConfig, devices } from '@playwright/test'

Error.stackTraceLimit = Infinity

let reporters: any = [
  ['list'],
  // ['junit'],
  ['html'],
]

let projects: PlaywrightTestConfig['projects'] = [
  {
    name: 'chromium',
    use: {
      browserName: 'chromium',
      ...devices['Desktop Chrome']
    },
  },
]

const config: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  testMatch: /__tests__\/.*\.pw\.ts/,
  reporter: reporters,
  use: {
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:3000',
    trace: 'on',
  },
  webServer: {
    command: 'node server/index.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects,
  workers: 1,
}

export default config
