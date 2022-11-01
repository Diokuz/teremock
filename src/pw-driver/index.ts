// https://playwright.dev/docs/network

import { extractPlaywrightRequest } from './request'
import { extractPlaywrightResponse } from './response'
import logger from '../logger'
import { loggerTrace, getTimeStampWithStrictOrder } from '../utils'
import { URL } from 'url'

import type { Driver, OnRequestHandler, OnResponseHandler } from '../types'
import type { Response, Route, Page } from 'playwright'

/**
 * There is no valid reason to have more than one driver instances per page
 */
const pagesSet = new Set()

const redirectCodes = [301, 302, 303, 305, 307, 308]

class PlaywrightDriver implements Driver {
  private page: Page
  private noParseResponseUrls: string[]
  private seenRedirects: Map<string, number>
  private _routeUrl = () => true

  constructor({ page, noParseResponseUrls = [] }: { page: Page, noParseResponseUrls?: string[] }) {
    logger.debug(`instantiating new playwright driver`)

    if (!page) {
      throw new Error('"page" is not defined')
    }

    if (pagesSet.has(page)) {
      logger.error(`second driver instantiation on the same page`)
      logger.error(`(probably you did not stop the mocker before start it again)`)
      throw new Error(`second driver instantiation on the same page`)
    }

    this.seenRedirects = new Map()
    this.noParseResponseUrls = noParseResponseUrls

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
    const handler = async (route: Route) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      loggerTrace(`${route.request().url()} ← page.on('request') fired`)

      const { request, abort, next, respond } = extractPlaywrightRequest(route, timestampWithOrder)

      await fn({ request, abort, next, respond })
    }

    await this.page.route(this._routeUrl, handler)

    return async () => {
      pagesSet.delete(this.page)
      try {
        await this.page.unroute(this._routeUrl, handler)
      } catch (e) {
        if (e.message.indexOf('has been closed') === -1) {
          throw e
        }
      }
    }
  }

  public async onResponse(fn: OnResponseHandler) {
    const handler = async (interceptedResponse: Response) => {
      const timestampWithOrder = getTimeStampWithStrictOrder()
      const url = interceptedResponse.request().url()

      if (redirectCodes.indexOf(interceptedResponse.status()) !== -1) {
        // see https://playwright.dev/docs/api/class-page#pagerouteurl-handler
        // Because of the way the page.route method works, the following redirection will not be handled by it.
        const newLocation = interceptedResponse.headers().location
        const destUrl = new URL(newLocation, url).toString()
        this.seenRedirects.set(destUrl, (this.seenRedirects.get(destUrl) || 0) + 1)
        logger.debug(`Redirection to "${newLocation}" from "${url}" will not be handled.`)
      }
      if (this.seenRedirects.get(url)) {
        this.seenRedirects.set(url, this.seenRedirects.get(url)! - 1)
        return
      }
      if (this.noParseResponseUrls.some((urlPart: string) => url.indexOf(urlPart) !== -1)) {
        logger.debug(`Response from url ${url} will not be parsed`)
        return
      }

      loggerTrace(`${url} → page.on('response') fired`)

      await fn(await extractPlaywrightResponse(interceptedResponse, timestampWithOrder))

      loggerTrace(`${url} → finish`)
    }

    // Intercepting all requests and respinding with mocks
    await this.page.on('response', handler)

    return () => this.page.off('response', handler)
  }

  public onClose(fn: (page: Page) => void): () => unknown {
    this.page.on('close', fn)

    return () => this.page.off('close', fn)
  }
}

export default PlaywrightDriver
