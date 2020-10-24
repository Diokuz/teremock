import got from 'got'
import express from 'express'
import { extractExpressRequest } from './request'
import { extractGotResponse, ExtractedResponse } from './response'
import { Driver, OnRequestHandler, OnResponseHandler, Request } from '../types'
import logger from '../logger'

/**
 * There is no valid reason to have more than one driver instances per express app
 */
const appSet = new Set()
const noop = () => {}

class ExpressDriver implements Driver {
  private isActive: boolean
  private app: express.Application
  private env: Record<string, string>
  private onRequestHandler: OnRequestHandler
  private onResponseHandler: OnResponseHandler

  constructor({ app, env }: { app: express.Application; env: Record<string, string> }) {
    logger.debug(`instantiating new driver`)

    if (appSet.has(app)) {
      throw new Error(`express app must be used as singleton`)
    }

    this.app = app
    this.env = env
    this.isActive = true

    // `/tinkoffApi/nearest_region?...` → `${env.tinkoffApi}/nearest_region?...`
    const resolveReal = (originalUrl, api, key) => {
      const url = api + originalUrl.replace(new RegExp(`/${key}`), '')

      // It could happen `//` – replace it with `/`
      return url.replace(/([^:])[/]+/g, '$1/')
    }

    for (let key in this.env) {
      const apiUrl = this.env[key]

      logger.info(`add proxy "/${key}" → "${apiUrl}"`)

      this.app.use('/' + key, async (req, res) => {
        logger.debug(`enter /${key} router with url "${req.originalUrl}"`, key)

        const realUrl = resolveReal(req.originalUrl, apiUrl, key)
        const getRealResponse = async (r: Request): Promise<ExtractedResponse> => {
          // omit requester-specific data, since it can break request
          const { host, origin, referer, ...rest } = r.headers || {}
          const opts: any = {
            method: r.method,
            headers: rest,
            throwHttpErrors: false,
          }

          if (r.body && r.method.toLowerCase() !== 'get') {
            switch (r.headers?.['content-type']) {
              case 'application/x-www-form-urlencoded':
                // we already converted r.body from string to obj in the express body parser middleware
                // so, we need to convert it back to string
                opts.body = new URLSearchParams(r.body).toString()
                break
              default:
                opts.body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
            }

            if (r.headers?.['content-length']) {
              opts.headers['content-length'] = Buffer.byteLength(opts.body, 'utf-8')
            }
          }

          try {
            const gotResponse = await got(realUrl, opts)

            return extractGotResponse(gotResponse)
          } catch (e) {
            return {
              url: 'error',
              status: 500,
              body: `got error message: ${e.message}`,
            }
          }
        }
        const driverReq = await extractExpressRequest(req, res, realUrl, getRealResponse)
        const { request, onRespondPromise } = driverReq
        // const timestamp = Date.now()

        logger.debug(`realUrl "${realUrl}"`)

        if (this.isActive) {
          this.onRequestHandler(driverReq)

          try {
            const resolved = await onRespondPromise
            const interceptor = resolved.interceptor
            let sendResp

            if ('response' in resolved) {
              const { response } = resolved
              sendResp = response
              this.onResponseHandler({
                request,
                response: {
                  ...response,
                },
                __meta: {
                  request,
                  interceptor,
                },
              })
            } else {
              const { realResponse } = resolved
              sendResp = realResponse
              // const t2 = Date.now()
              logger.debug(`realResponse`, realResponse)
              this.onResponseHandler({
                request,
                response: {
                  ...realResponse,
                  // ttfb: t2 - timestamp,
                },
                __meta: {
                  request,
                  interceptor,
                },
              })
            }

            // it doesn't matter what content-encoding was originally,
            // teremock has already decoded the response
            sendResp.headers['content-encoding'] = 'identity'
            delete sendResp.headers['x-content-encoding-over-network']
            res.status(sendResp.status).set(sendResp.headers).send(sendResp.body)
          } catch (e) {
            logger.error(e.message)
          }
        } else {
          res.status(500).send('driver not active')
        }
      })
    }
  }

  public setRequestInterception(arg: boolean) {
    this.isActive = arg
  }

  public onRequest(fn: OnRequestHandler) {
    this.onRequestHandler = fn

    return async () => {
      this.setRequestInterception(false)
      appSet.delete(this.app)
      this.onRequestHandler = noop
    }
  }

  public onResponse(fn: OnResponseHandler) {
    this.onResponseHandler = fn

    return () => {
      this.onResponseHandler = () => Promise.resolve()
    }
  }

  public onClose(fn) {
    return fn
  }
}

export default ExpressDriver
