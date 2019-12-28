import debug from 'debug'
import signale from './logger'
import { isCapturable, isPassable, parseUrl, isMockMatched } from './utils'
import getMockId from './mock-id'
import { Options, Response } from './types'

// const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const logger = debug('teremock:request')

type Params = Options & {
  reqSet: Set<string>
  _onReqStarted: Function
  _onReqsReject: Function
  pageUrl: () => string
}

async function sleep(time) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, time)
  })
}

async function respondWithDelay(respond, resp: Response) {
  const ttfb = resp?.ttfb ?? 0
  const actualDelay: number = typeof ttfb === 'function' ? ttfb() : ttfb

  logger('actualDelay', actualDelay)

  await sleep(Math.floor(actualDelay))

  respond(resp)
}

// Need type string here
// https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#requestrespondresponse
const getBodyStr = (body): string => typeof body === 'string' ? body : JSON.stringify(body)

export default function createHandler(initialParams) {
  logger('Creating request handler')

  return async function handleRequest({ request, abort, next, respond }, extraParams = {}, inlineMocks: any = []) {
    const params: Params = { ...initialParams, ...extraParams }
    const { storage, pageUrl, reqSet, ci, pass, mockMiss, naming, response: globalResp } = params
    const purl = typeof pageUrl === 'function' ? pageUrl() : pageUrl

    const reqParams = { url: request.url, method: request.method, body: request.body }
    logger(`» intercepted request with method "${request.method}" and url "${request.url}"`)
    logger(`request handling for:`, reqParams)
    logger(`request headers :`, request.headers)

    if (!isCapturable({ capture: params.capture, request })) {
      logger('» not for capturing')

      if (isPassable({ pass, pageUrl: purl, reqUrl: request.url, method: request.method })) {
        logger(`» url is from pass list, sending it to real server`)
        next()
        return
      }

      signale.warn(`url ${request.url} is not from the options.pass, aborting request`)
      signale.warn(`pageUrl is "${purl}", pass is "${JSON.stringify(pass)}"`)
      abort('aborted')

      return
    }

    // is for capturing from here!

    const bodyStr = getBodyStr(request.body)
    const mockId = getMockId({ ...request, naming, body: bodyStr })

    params._onReqStarted({ ...parseUrl(request.url), url: request.url, method: request.method, body: request.body })
    reqSet.add(mockId)
    debug('teremock:connections:add')(mockId, Array.from(reqSet))

    logger(`» trying to get mock with id "${mockId}"`)

    if (inlineMocks.length) {
      logger(`» inline mocks defined, looking for match`)

      const inlineMock = inlineMocks.find(([filter]) => isMockMatched(filter, request))

      if (inlineMock) {
        // @ts-ignore
        const [_filter, inlineResp] = inlineMock

        logger(`» inline mock found, responding`)

        const resp: Response = {
          ...inlineResp,
          body: getBodyStr(inlineResp.body),
          ...globalResp,
        }

        await respondWithDelay(respond, resp)

        return
      } else {
        logger(`» inline mock not found, proceeding with storage mocks`)
      }
    }

    const mockExists = await storage.has(mockId, { wd: params.wd })

    if (mockExists) {
      logger(`» mock exists!`)

      const mock = await storage.get(mockId, { wd: params.wd })
      const bodyStr = getBodyStr(mock.response.body)
      const resp = {
        ...mock.response,
        body: bodyStr,
        ...globalResp,
      }

      logger(`« successfully read from "${mockId}", responding with:`, bodyStr.slice(0, 100))

      await respondWithDelay(respond, resp)
    } else {
      logger(`» mock does not exist!`)

      if (ci) {
        logger(`is ci mode, checking mockMiss middleware`)

        if (typeof mockMiss === 'number') {
          logger(`responding with number`)
          respond({
            code: mockMiss,
            body: `Mock "${mockId}" not found`,
          })
        } else if (typeof mockMiss === 'function') {
          logger(`responding via function`)
          mockMiss((response) => respond(response))
        } else {
          logger(`mockMiss is not defined, rejecting`)
          params._onReqsReject(`Wrong mockMiss value. Check mocker.start() params and read the docks.`)
        }
      } else {
        logger('« about to next()...')
        next()
      }
    }
  }
}
