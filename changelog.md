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
