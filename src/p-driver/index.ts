import { extractPuppeteerRequest } from './request'
import { extractPuppeteerResponse } from './response'
import logger from '../logger'
import { loggerTrace, getTimeStampWithStrictOrder } from '../utils'

import type { Driver, OnRequestHandler, OnResponseHandler } from '../types'
import type { Request as PuppeteerRequest, Response as PuppeteerResponse, Page } from 'puppeteer'

/**
 * There is no valid reason to have more than one driver instances per page
 */
const pagesSet = new Set()

class PuppeteerDriver implements Driver {
  private page: Page

  constructor({ page }: any) {
    logger.debug(`instantiating new driver`)

    if (!page) {
      throw new Error('"page" is not defined')
    }

    if (pagesSet.has(page)) {
      logger.error(`second driver instantiation on the same page`)
      logger.error(`(probably you did not stop the mocker before start it again)`)
      throw new Error(`second driver instantiation on the same page`)
    }

    this.page = page
    this.setRequestInterception(true)
    pagesSet.add(page)

    this.page.on('close', () => {
      this.setRequestInterception(false)
      pagesSet.delete(this.page)
    })
  }

  public async setRequestInterception(arg: boolean) {
    await this.page.setRequestInterception(arg)
  }

  public async onRequest(fn: OnRequestHandler): Promise<() => Promise<void>> {
    const handler = async (interceptedRequest: PuppeteerRequest) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      loggerTrace(`${interceptedRequest.url()} ← page.on('request') fired`)

      const { request, abort, next, respond } = await extractPuppeteerRequest(interceptedRequest, timestampWithOrder)

      fn({ request, abort, next, respond })
    }

    // Intercepting all requests and respinding with mocks
    await this.page.on('request', handler)

    return async () => {
      await this.setRequestInterception(false)
      pagesSet.delete(this.page)
      await this.page.off('request', handler)
    }
  }

  public async onResponse(fn: OnResponseHandler): Promise<() => void> {
    const handler = async (interceptedResponse: PuppeteerResponse) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      const url = interceptedResponse.request().url()

      loggerTrace(`${url} → page.on('response') fired`)

      await fn(await extractPuppeteerResponse(interceptedResponse, timestampWithOrder))

      loggerTrace(`${url} → finish`)
    }

    // Intercepting all requests and respinding with mocks
    this.page.on('response', handler)

    return () => this.page.off('response', handler)
  }

  public onClose(fn: () => void): () => void {
    this.page.on('close', fn)

    return () => this.page.off('close', fn)
  }
}

export default PuppeteerDriver
