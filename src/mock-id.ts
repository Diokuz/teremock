import getRequestId from './request-id'
import { GetMockIdParams } from './types'

/**
 * Returns uniq mock id.
 * Warning! Two different real request may have one mock id,
 * because getRequestId does not account for blacklisted query and body params.
 * Also, two equal mocks may be stored in two different files, because of
 * different options.wd
 */
const getMockId = (params: GetMockIdParams) => {
  const { url, naming, name, method, body, headers } = params
  const { hostname, pathname } = new URL(url)

  let pathId = name

  if (!pathId || pathId.startsWith('__')) {
    const slugs: string[] = pathname.split('/').filter((s) => !!s)
    slugs.unshift(hostname)

    pathId = slugs.join('-')
  }

  const requestId = getRequestId({ url, naming, method, body, headers })
  const mockId = pathId + '--' + requestId

  return mockId
}

export default getMockId
