import got from 'got'
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
  private app: any
  private env: Record<string, string>
  private onRequestHandler: OnRequestHandler
  private onResponseHandler: OnResponseHandler

  constructor({ app, env }: any) {
    logger.debug(`instantiating new driver`)

    if (appSet.has(app)) {
      throw new Error(`express app must be used as singleton`)
    }

    this.app = app
    this.env = env
    this.isActive = true

    // `/tinkoffApi/nearest_region?...` → `${env.tinkoffApi}/nearest_region?...`
    const resolveReal = (originalUrl, api, key) => api + originalUrl.replace(new RegExp(`/${key}`), '')

    for (let key in this.env) {
      const apiUrl = this.env[key]

      logger.info(`add proxy "/${key}" → "${apiUrl}"`)

      this.app.use('/' + key, async (req, res) => {
        logger.info(`enter /${key} router with url "${req.originalUrl}"`, key)

        const realUrl = resolveReal(req.originalUrl, apiUrl, key)
        const getRealResponse = async (r: Request): Promise<ExtractedResponse> => {
          const opts: any = {
            method: r.method,
            headers: r.headers,
          }
          const gotResponse = await got(realUrl, opts)

          return extractGotResponse(gotResponse)
        }
        const driverReq = await extractExpressRequest(req, res, realUrl, getRealResponse)
        const { request, onRespondPromise } = driverReq
        const timestamp = Date.now()

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
                  __meta: {
                    ...response.__meta,
                    interceptor,
                  },
                },
              })
            } else {
              const { realResponse } = resolved
              sendResp = realResponse
              const t2 = Date.now()
              logger.debug(`realResponse`, realResponse)
              this.onResponseHandler({
                request,
                response: {
                  __meta: {
                    request,
                    interceptor,
                  },
                  ...realResponse,
                  ttfb: t2 - timestamp,
                },
              })
            }

            res
              .status(sendResp.status)
              .set(sendResp.headers)
              .send(sendResp.body)
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
      this.onResponseHandler = noop
    }
  }

  public onClose(fn) {
    return fn
  }
}

export default ExpressDriver
