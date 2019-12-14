import { URL } from 'url'

const matches = (arr, str) => !!arr.find((el) => str.includes(el))

// @todo tests
const shouldNotIntercept = (mockList = [], okList = [], url = '') => {
  const inOkList = matches(okList, url)
  const inMockList = matches(mockList, url)
  const inAnyList = inOkList || inMockList
  const listsAreConfigured = mockList.length > 0 || okList.length > 0

  // If mockList/okList werent set – intercept all requests except localhost
  return (listsAreConfigured && !inAnyList) || (!listsAreConfigured && url.includes('localhost'))
}

const shouldOk = (mockList = [], okList = [], url = '') => {
  const inOkList = matches(okList, url)
  const inMockList = matches(mockList, url)

  return inOkList && !inMockList
}

function isSameOrigin(url1, url2) {
  const p1 = new URL(url1)
  const p2 = new URL(url2)

  return p1.host === p2.host && p1.protocol === p2.protocol
}

function isPassableByDefault(pageUrl, reqUrl, method) {
  return method === 'GET' && isSameOrigin(pageUrl, reqUrl)
}

export { matches, shouldNotIntercept, shouldOk, isPassableByDefault }
