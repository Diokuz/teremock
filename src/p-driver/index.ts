import { extractPuppeteerRequest } from './request'
import { extractPuppeteerResponse } from './response'
import { Driver, OnRequestHandler, OnResponseHandler } from '../types'
import logger from '../logger'
import { loggerTrace } from '../utils'

/**
 * There is no valid reason to have more than one driver instances per page
 */
const pagesSet = new Set()

class PuppeteerDriver implements Driver {
  private page: any

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

  public onRequest(fn: OnRequestHandler) {
    const handler = async (interceptedRequest) => {
      loggerTrace(`${interceptedRequest.url()} ← page.on('request') fired`)

      const { request, abort, next, respond } = await extractPuppeteerRequest(interceptedRequest)

      fn({ request, abort, next, respond })
    }

    // Intercepting all requests and respinding with mocks
    this.page.on('request', handler)

    return async () => {
      await this.setRequestInterception(false)
      pagesSet.delete(this.page)
      await this.page.off('request', handler)
    }
  }

  public onResponse(fn: OnResponseHandler) {
    const handler = async (interceptedResponse) => {
      const url = interceptedResponse.request().url()

      loggerTrace(`${url} → page.on('response') fired`)

      await fn(await extractPuppeteerResponse(interceptedResponse))

      loggerTrace(`${url} → finish`)
    }

    // Intercepting all requests and respinding with mocks
    this.page.on('response', handler)

    return () => this.page.off('response', handler)
  }

  public onClose(fn) {
    this.page.on('close', fn)

    return () => this.page.off('close', fn)
  }
}

export default PuppeteerDriver
