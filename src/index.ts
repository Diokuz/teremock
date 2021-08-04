import Teremock from './teremock'
import PlaywrightDriver from './pw-driver'

const teremock = new Teremock()

export { Teremock, PlaywrightDriver }
export default teremock

export * from './types'
