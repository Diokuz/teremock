import { extractPuppeteerRequest } from './request'
import { extractPuppeteerResponse } from './response'
import { Driver, OnRequestHandler, OnResponseHandler } from '../types'
import logger from '../logger'

/**
 * There is no valid reason to have more than one driver instances per page
 */
const pagesSet = new Set()

class PuppeteerDriver implements Driver {
  private page: any

  constructor({ page }: any) {
    if (!page) {
      throw new Error('"page" is not defined')
    }

    if (pagesSet.has(page)) {
      logger.error(`second driver instantiation on the same page`)
      logger.error(`(probably you did not stop the mocker before start it again)`)
      throw new Error(`second driver instantiation on the same page`)
    }

    this.page = page
    this.page.setRequestInterception(true)
    pagesSet.add(page)

    this.page.on('close', () => {
      this.page.setRequestInterception(false)
      pagesSet.delete(this.page)
    })
  }

  setRequestInterception(arg: boolean) {
    this.page.setRequestInterception(arg)
  }

  onRequest(fn: OnRequestHandler) {
    const handler = async (interceptedRequest) => {
      const { request, abort, next, respond } = await extractPuppeteerRequest(interceptedRequest)

      fn({ request, abort, next, respond })
    }

    // Intercepting all requests and respinding with mocks
    this.page.on('request', handler)

    return () => {
      this.page.setRequestInterception(false)
      pagesSet.delete(this.page)
      this.page.off('request', handler)
    }
  }

  onResponse(fn: OnResponseHandler) {
    const handler = async (interceptedResponse) => {
      const { request, response: pResponse } = await extractPuppeteerResponse(interceptedResponse)

      fn({ request, response: pResponse })
    }

    // Intercepting all requests and respinding with mocks
    this.page.on('response', handler)

    return () => this.page.off('response', handler)
  }

  onClose(fn) {
    this.page.on('close', fn)

    return () => this.page.off('close', fn)
  }

  getPageUrl() {
    return this.page.url()
  }
}

export default PuppeteerDriver
