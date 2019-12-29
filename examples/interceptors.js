/**
 * This file contains some examples of interceptors.
 * See docs https://github.com/diokuz/teremock#interceptor
 */

// any url, containing `/api`, and query param `foo=bar`. Response will be extracted from fs, if exists.
const foobarInterceptor = {
  url: '/api',
  query: { foo: 'bar' }
}

// respond 404 status code for any xhr/fetch request
const notFoundInterceptor = {
  response: { status: 404 }
}

// respond 404 status code for any request
const notFoundAtAllInterceptor = {
  resourceTypes: '*',
  response: { status: 404 }
}

// respond `access-control-allow-origin: *` for any `option` _xhr_ and _document_ request with 354 ms delay.
const allowOriginInterceptor =  {
  methods: 'option',
  response: {
    headers: { 'access-control-allow-origin': '*' },
    ttfb: 354
  },
  resourceTypes: `xhr,document`
}

// Default teremock interceptor
// Intercepts any xhr/fetch request, and prevents real backend request (when CI or when mock file exist).
const DEFAULT_INTERCEPTOR_CAPTURE = {
  resourceTypes: 'xhr,fetch'
}

// Last standing default teremock interceptor: passes all requests, not intercepted before, to real server
// That includes all requests for your test app and its resources
const DEFAULT_INTERCEPTOR_PASS = {
  pass: true,
  resourceTypes: '*'
}
