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
  passList: string[]
  response: any
  storage: {
    get: Function
    set: Function
  }
  capture: Capture
  pass: Pass
  delay: number
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
}
