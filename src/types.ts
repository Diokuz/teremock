type ListItem = string | string[]

type List = ListItem[]

export interface Storage {
  get: (key: string) => Promise<any>
  set: (key: string, data: any) => Promise<void>
  has: (key: string) => Promise<boolean>
}

export type Naming = {
  query?: {
    whitelist?: string[]
    blacklist?: string[]
  }
  body?: {
    whitelist?: List
    blacklist?: List
  }
}

export type Capture = {
  urls: string[]
  methods: string[]
}

export type Pass = {
  urls: string[]
  methods: string[]
}

export type Interceptor = {
  name: string // from keys of UserInterceptor
  url: string
  methods: Set<string>
  query?: Record<string, any>
  body?: Record<string, any>
  pass: boolean
  hash?: Naming
  response?: Response
}

export type UserInterceptor = {
  name?: string
  url?: string
  methods?: string
  query?: Record<string, any>
  body?: Record<string, any>
  pass?: boolean
  response?: Response
}

export type Options = {
  interceptors: Record<string, Interceptor>

  wd: string
  ci: boolean
  response?: Response
  skipResponseHeaders: string[]
  awaitConnectionsOnStop: boolean
}

export type UserOptions = {
  page?: any
  interceptors?: Record<string, UserInterceptor>
  skipResponseHeaders?: string[]
}

export type Request = {
  url: string
  method: string
  headers: Record<string, string>
  body?: string | Record<string, any>
}

export type Response = {
  url: string
  status: number
  headers: Record<string, string>
  ttfb: (() => number) | number
  body?: string | Record<string, any>
}

export type DrivetRequest = {
  request: Request
  abort: Function
  next: Function
  respond: (data: any) => void
}

export type DrivetResponse = {
  request: Request
  response: Response
}

export type OnRequestHandler = (arg: DrivetRequest) => void

export type OnResponseHandler = (arg: DrivetResponse) => void

export interface Driver {
  setRequestInterception: (switchOn: boolean) => void
  onRequest: (fn: OnRequestHandler) => Function
  onResponse: (fn: OnResponseHandler) => Function
  onClose: (fn: any) => Function
  getPageUrl: () => string
}
