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

export type Options = {
  wd: string
  naming: Naming
  mockList: string[]
  mockMiss: string | Function | number
  ci: boolean
  passList: string[]
  response: any

  // deprecated
  cacheRequests: boolean
  verbose: boolean
  okList: string[]
  responseHeaders: any
}

export type UserOptions = {
  mockList?: string | string[]
  okList?: string | string[]
}
