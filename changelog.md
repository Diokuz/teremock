## 2.0.0

- Playwright driver by default
- Drop express and puppeteer drivers
- Fixed bug with `request.body: null` accounted for mockId
- Remove page.onClose handler (no autostop on page close)
- Remove esm/type module (back to commonjs)

## 1.10.3

- Add debug log for all matched request at `stop()`
- Add options.onStop method
- Fix https://github.com/Diokuz/teremock/issues/14
- Fix https://github.com/Diokuz/teremock/issues/30

## 1.9.0

- Add Playwright support

## 1.8.0

- Request body matcher now uses lodash.isMatch, which support nested properties

## 1.7.0

- Add request and response `order` incremental mark for debug

## 1.6.0

- Add request id and request/response timestamps (see also spy.events)

## 1.5.0

- Request Body matching for application/json requests

## 1.4.0

- Remove content-encoding header for e-driver responses
- Update all deps

## 1.3.0

- Add formData support for interceptor.body predicate.

## 1.1.0

- Deprecate teremock.connections() ← there many race-conditions when awaiting connections() is confusing and may lead to hard debugging. E.g. you start awaiting connections before actual connections were made.
- Add teremock:trace logs for debugging.

## 1.0.1

- Fix bug when spies wehe not working with inline mocks

## 1.0.0

- Add docs about functional interceptors

## 0.16.0

- Fix case when teremock was started during request

## 0.15.0

- TypeScript target is changed to `ES2018`
