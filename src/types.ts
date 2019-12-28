type ListItem = string | string[]

type List = ListItem[]

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

export type Options = {
  wd: string
  naming: Naming
  mockMiss: string | Function | number
  ci: boolean
  response: any
  storage: {
    get: (id: string, opts?: any) => Promise<Record<string, any>>
    set: (id: string, data: any, opts?: any) => Promise<void>
    has: (id: string, opts?: any) => Promise<boolean>
  }
  capture: Capture
  pass: Pass
  delay: number

  page: any
  pagesSet: Set<any>
  skipResponseHeaders: string[]
  awaitConnectionsOnStop: boolean
}

export type UserOptions = {
  capture?: {
    urls?: string[]
    methods?: string[]
  }
  pass?: {
    urls?: string[]
    methods?: string[]
  }
  delay?: number

  page?: any
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
}
