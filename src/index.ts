import Teremock from './teremock'
import PlaywrightDriver from './pw-driver'

const teremock = new Teremock()

export { Teremock, PlaywrightDriver }
export default teremock

export * from './types'
export * from './utils'
export { default as getMockId } from './mock-id'
export { default as getRequestId } from './request-id'
