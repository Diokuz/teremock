import path from 'path'
import debug from 'debug'
import signale from 'signale'
import { shouldOk, shouldNotIntercept } from './utils'
import * as storage from './storage'

const logger = debug('prm:response')

export default function createHandler(initialParams) {
  logger('Creating response handler')

  return function handlerResponse(interceptedResponse, extraParams = {}) {
    const params = { ...initialParams, ...extraParams }
    const {
      reqSet,
      workDir,
      mockList,
      okList,
      verbose,
      ci,
      queryParams,
      skipQueryParams,
      skipPostParams,
      skipResponseHeaders,
    } = params
    const request = interceptedResponse.request()
    const postData = request.postData() || ''
    const url = request.url()
    const method = request.method()
    const requestHeaders = request.headers()
    const resParams = { url, method, postData }
    const responseHeaders = interceptedResponse.headers()
    const responseStatus = interceptedResponse.status()

    if (skipResponseHeaders && skipResponseHeaders.length) {
      skipResponseHeaders.forEach((headerName) => delete responseHeaders[headerName])
    }

    logger(`» Intercepted response with method "${method}" and url "${url}"`)

    if (verbose) {
      signale.info(`Response handling for:\n${resParams}`)
      signale.info(`Request headers :\n${requestHeaders}`)
      signale.info('decodeURIComponent(postData)', decodeURIComponent(postData))
      signale.info('encodeURIComponent(postData)', encodeURIComponent(postData))
    }

    // If synthetic OK-response, no needs to write it to fs
    if (shouldNotIntercept(mockList, okList, url) || shouldOk(mockList, okList, url)) {
      logger('» shouldNotIntercept or shouldOk. Skipping.')

      return
    }

    const mock_params = {
      url,
      method,
      headers: requestHeaders,
      postData,
      queryParams,
      skipQueryParams,
      skipPostParams,
      verbose,
      workDir,
    }

    const fn = storage.name(mock_params)

    logger(`» Preparing to write a new file (if it does not exist and it is not CI) ${fn}`)

    interceptedResponse
      .json()
      .catch((e) => {
        logger('« interceptedResponse.json() error:', e)
        return interceptedResponse.text()
      })
      .then((body) => {
        if (typeof body === 'string') {
          logger(`« Response body starts with: ${body.substr(0, 100)}`)
        }
        logger(`« Sending the response to storage.write`)

        if (ci) {
          reqSet.delete(fn)
          debug('prm:connections:delete')(
            path.basename(fn),
            Array.from(reqSet).map((f: string) => path.basename(f))
          )

          return
        }

        let postDataToWrite = postData

        try {
          postDataToWrite = JSON.parse(postData)
        } catch (e) {
          // pass
        }

        /*
         * Do not write in CI, because
         * 1) It is forbidden anyway (handle mock-miss in storage.read)
         * 2) Because it breaks mockMiss behavior
         */
        return storage
          .write({
            url,
            fn,
            body: JSON.stringify(
              {
                request: {
                  method,
                  url,
                  headers: requestHeaders,
                  postData: postDataToWrite,
                },
                response: {
                  status: responseStatus,
                  headers: responseHeaders,
                  body,
                },
              },
              null,
              '  '
            ),
            ci,
          })
          .then((e: any) => {
            logger(`« Successfully exited from storage.write for file ${e.fn}`)

            reqSet.delete(e.fn)
            debug('prm:connections:delete')(
              path.basename(fn),
              Array.from(reqSet).map((f: string) => path.basename(f))
            )
          })
          .catch((err) => {
            debug('prm:connections:delete')('fail', path.basename(fn), err)
            signale.error(`Fail to save the file because of `, err)
            params._onReqsReject('WRITEERR')
          })
      })
      .catch((err) => {
        logger('« interceptedResponse.text error:', err)
      })
      .then(() => {
        // finally
        logger(`« About to exit the response handler. reqSet.size is ${reqSet.size}`)

        if (reqSet.size === 0) {
          logger('« Invoking _onReqsCompleted')

          params._onReqsCompleted()

          logger('« Response is done.')
        }
      })
  }
}
