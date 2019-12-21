import debug from 'debug'
import signale from 'signale'
import { isCapturable } from './utils'
import getMockId from './mock-id'

const logger = debug('teremock:response')

export default function createHandler(initialParams) {
  logger('Creating response handler')

  return function handlerResponse(interceptedResponse, extraParams = {}) {
    const params = { ...initialParams, ...extraParams }
    const { storage, reqSet, wd, capture, verbose, ci, queryParams, skipResponseHeaders } = params
    const request = interceptedResponse.request()
    const postData = request.postData() || ''
    const url = request.url()
    const method = request.method()
    const requestHeaders = request.headers()
    const responseHeaders = interceptedResponse.headers()
    const responseStatus = interceptedResponse.status()

    if (skipResponseHeaders && skipResponseHeaders.length) {
      skipResponseHeaders.forEach((headerName) => delete responseHeaders[headerName])
    }

    logger(`» Intercepted response with method "${method}" and url "${url}"`)

    const dontIntercept = !isCapturable({ capture, request: { url, method } })

    if (dontIntercept) {
      logger(`» dontIntercept "${dontIntercept}". Skipping.`)

      return
    }

    const mock_params = {
      url,
      method,
      headers: requestHeaders,
      body: postData,
      queryParams,
      verbose,
      wd,
    }

    const mockId = getMockId(mock_params)

    logger(`» Preparing to set a new mock (if it does not exist and it is not CI) ${mockId}`)

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
        logger(`« Sending the response to storage.set`)

        if (ci) {
          reqSet.delete(mockId)
          debug('teremock:connections:delete')(mockId, Array.from(reqSet))

          return
        }

        let bodyToWrite = postData

        try {
          bodyToWrite = JSON.parse(postData)
        } catch (e) {
          // pass
        }

        /*
         * Do not write in CI, because
         * 1) It is forbidden anyway (handle mock-miss in storage.read)
         * 2) Because it breaks mockMiss behavior
         */
        return storage
          .set(
            mockId,
            {
              url,
              body: JSON.stringify(
                {
                  request: {
                    method,
                    url,
                    headers: requestHeaders,
                    body: bodyToWrite,
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
            },
            { wd: params.wd }
          )
          .then((e: any) => {
            logger(`« successfully exited from storage.set for mock ${e && e.fn}`)

            reqSet.delete(mockId)
            debug('teremock:connections:delete')(mockId, Array.from(reqSet))
          })
          .catch((err) => {
            debug('teremock:connections:delete')('fail', mockId, err)
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
