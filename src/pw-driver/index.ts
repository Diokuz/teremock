// https://playwright.dev/docs/network

import { extractPlaywrightRequest } from './request'
import { extractPlaywrightResponse } from './response'
import { Driver, OnRequestHandler, OnResponseHandler } from '../types'
import logger from '../logger'
import { loggerTrace, getTimeStampWithStrictOrder } from '../utils'
import { Response, Page } from 'playwright'

/**
 * There is no valid reason to have more than one driver instances per page
 */
const pagesSet = new Set()

class PlaywrightDriver implements Driver {
  private page: Page

  constructor({ page }: { page: Page }) {
    logger.debug(`instantiating new playwright driver`)

    if (!page) {
      throw new Error('"page" is not defined')
    }

    if (pagesSet.has(page)) {
      logger.error(`second driver instantiation on the same page`)
      logger.error(`(probably you did not stop the mocker before start it again)`)
      throw new Error(`second driver instantiation on the same page`)
    }

    this.page = page
    pagesSet.add(page)

    this.page.on('close', () => {
      pagesSet.delete(this.page)
    })
  }

  public async setRequestInterception(_arg: boolean) {
    // do nothing for playwright
  }

  public async onRequest(fn: OnRequestHandler) {
    const handler = (route) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      loggerTrace(`${route.request().url()} ← page.on('request') fired`)

      const { request, abort, next, respond } = extractPlaywrightRequest(route, timestampWithOrder)

      fn({ request, abort, next, respond })
    }

    await this.page.route(() => true, handler)

    return async () => {
      pagesSet.delete(this.page)
      await this.page.unroute(() => true, handler)
    }
  }

  public async onResponse(fn: OnResponseHandler) {
    const handler = async (interceptedResponse: Response) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      const url = interceptedResponse.request().url()

      loggerTrace(`${url} → page.on('response') fired`)

      await fn(await extractPlaywrightResponse(interceptedResponse, timestampWithOrder))

      loggerTrace(`${url} → finish`)
    }

    // Intercepting all requests and respinding with mocks
    await this.page.on('response', handler)

    return () => this.page.off('response', handler)
  }

  public onClose(fn) {
    this.page.on('close', fn)

    return () => this.page.off('close', fn)
  }
}

export default PlaywrightDriver
