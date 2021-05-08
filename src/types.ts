import type { ErrorCode as PErrorCode } from 'puppeteer'
export type Headers = Record<string, string>

export interface Request {
  url: string
  method: string
  headers?: Headers
  body?: string | Record<string, any> | null
  resourceType: string
  id?: number
  timestamp?: number
  order?: number
}

export type DriverErrorCode = PErrorCode

export type ArgRequest = Request & { query: Record<string, string> }

export interface Response {
  url: string
  status: number
  headers?: Headers
  // By default, ttfb is not stored in file mocks, because
  // 1. It makes test run longer
  // 2. It makes impossible simultaneous use of response.ttfb and options.response.ttfb
  ttfb?: number | number[]
  body?: any
  timestamp?: number
  order?: number
}

export interface GetMockIdParams {
  url: string
  naming: Naming
  name?: string
  method?: string
  body?: string
  headers?: Headers
}

export type ResponseFunc = (req: ArgRequest) => Promise<Partial<Response>>
export type DefResponse = Partial<Response> | ResponseFunc

type ListItem = string | string[]

export type List = ListItem[]

// @todo generic, do I really need it?
export interface Storage {
  get: (key: string) => Promise<{ request: Request, response: Response }>
  set: (key: string, data: { request: Request, response: Response }) => Promise<void>
  has: (key: string) => Promise<boolean>
  setWd: (wd: string | string[]) => void
}

export interface Naming {
  query?: {
    whitelist?: string[]
    blacklist?: string[]
  }
  body?: {
    whitelist?: List
    blacklist?: List
  }
}

export interface Capture {
  urls: string[]
  methods: string[]
}

export interface Pass {
  urls: string[]
  methods: string[]
}

export interface Interceptor {
  name: string // from keys of UserInterceptor. If no name, hostname+path is used
  url: string
  methods: Set<string>
  resourceTypes: Set<string>
  query?: Record<string, any>
  body?: Record<string, any>
  pass: boolean
  naming?: Naming
  response?: DefResponse
}

export interface UserInterceptor {
  name?: string
  url?: string
  methods?: Set<string> | string
  resourceTypes?: Set<string> | string
  query?: Record<string, any>
  body?: Record<string, any>
  pass?: boolean
  naming?: Naming
  response?: DefResponse
}

export interface CommonOptions {
  ci: boolean
  page?: any
  skipResponseHeaders: string[]
  skipRequestHeaders: string[]
  awaitConnectionsOnStop: boolean
  responseOverrides?: Partial<Response>
  wd?: string | string[]
  onStop?: (arg: { matched: Map<string, string[]> }) => void
}
export interface Options extends CommonOptions {
  interceptors: Record<string, Interceptor>
  getMockId: (arg: GetMockIdParams) => string
}

export interface UserOptions extends Partial<CommonOptions> {
  interceptors?: Record<string, UserInterceptor>
  getMockId?: (arg: GetMockIdParams) => string | undefined
}

export interface Meta {
  request: Request
  interceptor: Interceptor
}

export interface DriverRequest {
  request: Request
  abort(errCode: DriverErrorCode): Promise<void>
  next(interceptor: Interceptor): Promise<void>
  respond(response: Response, interceptor: Interceptor): Promise<void>
}

export interface DriverResponse {
  request: Request
  response: Response
  __meta?: Meta // Could be abscent in case when request was made before teremock.start()
}

export type OnRequestHandler = (arg: DriverRequest) => Promise<void>
export type OnResponseHandler = (arg: DriverResponse) => Promise<void>

export interface Driver {
  setRequestInterception: (switchOn: boolean) => void
  onRequest: (fn: OnRequestHandler) => Promise<Function>
  onResponse: (fn: OnResponseHandler) => Promise<Function>
  onClose: (fn: any) => Function
}

export interface ExtractDriverReqResOptions {
  order: number
  timestamp: number
}

export type EventInfo = {
  requestTimestamp: number
  responseTimestamp?: number
  requestOrder: number
  responseOrder?: number
  requestId: number
}

export type Spy = {
  called: boolean
  calledOnce: boolean
  callCount: number
  dismiss: () => void
  events: EventInfo[]
}
export type SpyTuple = [Interceptor, Spy]
