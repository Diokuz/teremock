> WIP: this package is under construction! Use `puppeteer-request-mocker` for now.

# teremock

## Do I need that thing?

If you are writing puppeteer tests, and you want to mock your network responses easily – probably yes.

## How to use

```js
import mocker from 'teremock'

// navigate your test page

await mocker.start()

// async stuff which is making requests, including redirects

await mocker.stop()
```

## How it works

First, `teremock` intercepts puppeteers page requests and tries to find corresponding responses in files. Generated filename depends on request `url`, `method` and `body` – so, you always know, do you have a mock for that particular request or not. If you have it – you will get it as a response. If not – request will go to the real backend.

Second, `teremock` intercepts all responds, and writes them to the filesystem, if they are not on it already.

> Important to note! By default, teremock intercepts all requests, including html, assets, and even fonts requests! So, technically, you could mock not only requests from your testpage, but testpage itself! To prevent that, start mocker _after_ navigtion to your testpage happened, or use `options.interceptors` to filter requests to be mocked. See `examples/mock-testpage-itself/` for details.

## options

```js
mocker.start(options)
```
All options are optional (that's why they called so), except `page`.

```js
const options = {
  // puppeteer page
  // global.page by default
  page: page,

  // Named list of request interceptors
  interceptors: {
    example_com_api: {
      url: 'example.com',
      methods: new Set(['get', 'post']),
    },
    my_another_api: {
      url: '/path/to/my/api',
    },
    option_requests: {
      url: '*',
      methods: 'option',
      response: {
        headers: {
          'allow-origin': '*'
        }
      }
    },
    all_other_requests: {
      middleware: () => ({ status: 500, body: 'request is not allowed!' })
    }
  },

  // Absolute path to working directory, where you want to store mocks
  // path.resolve(process.cwd(), '__teremocks__') by default
  wd: path.resolve(__dirname, '__teremocks__'),

  // Run as CI if true. In CI mode storage will not try to save any mocks.
  // Default is `is-ci` package value (same as in Jest)
  ci: false,

  // Set true, to await all non-closed connections when trying to stop mocker
  // Warning: some tests could became flaky
  awaitConnectionsOnStop: false,

  // Custom delay between request and response for mocked responses
  // Default value is mockde ttfb value
  ttfb: () => Math.random() * 1000
}
```

### Interceptor

Interceptor – is a big conception in `teremock`. Interceptor is an object, which have two different groups of properties:

1. Matcher group: it determines, whether to intercept particular request, or not.
2. Provider group: if yes, how exactly: 1) pass to real backend 2) respond with inline resoponse 3) try to find response mock on file system.

Interceptor is used, if _all_ matchers are matched against request. So, if one matcher is not matched, interceptor will not be used.

**Matcher group properties** are:

#### interceptor.url [string]

A string, which defines urls to match. It works when `request.url.includes(url) === true` – so, `ample.com` will match both `http://exampe.com` as well as `https://not-example.com/api?foo-bar`. Note: prefer not to place query params to urls, because they could be randomly sorted in real request.

#### interceptor.query [Object]

Unsorted one-level object of query params. Missing params will not affect the interception. Example: `{ foo: 'bar' }` will match `<url>?foo=bar` as well as `<url>?alice=bob&foo=bar&baz=1`.

Duplicated values (e.g. `?foo=bar&foo=baz`) are not supported now.

#### interceptor.methods [string]

Comma-separated list of http methods to be matched. Example: `get,post,put`.

#### interceptor.headers [Object]

Unsorted one-level ignore-cased object of _request_ headers.

#### interceptor.body [Object]

Unsorted deep object to match request body.

**Provider group properties** are:

#### interceptor.pass [boolean]

If `true`, pass request to the real backend. It is not recommended to pass any request outside of your app, since your tests became unstable and dependent from backends stability and availability.

#### interceptor.response [Object]

If present, it is used instead of file-based mocks. Usefull for testing different responses for the same request, and/or for mocking big-sized data.

Example:

```ts
const response = {
  status: 200,
  headers: { ... },
  body: { foo: 'bar' }, // could be string as well
  ttfb: 50, // ms to wait before responding
}
```

#### interceptor

### Mock files naming

The name of mock file is consist of five parts: 1) `options.wd` value 2) named directory 3) lowercased http method 4) query or three words 5) `.json` extension.

The most important part is `4) query or three words`. If request method is `get`, and query is short enough, it is used. Otherwice, three words are used. These words are pseudorandom, and depends on a) request url (without query) b) query params (sorted) c) body params (sorted).

@todo examples

In many cases it is important to be independent from some query and body params, which, for example, have random value for each request (e.g. timestamp). There are four different list for skipping some parameters, when calculating mock filename: whitelist and blacklist for query and body parameters. Here its typing:

```ts
type ListItem = string | string[]
type List = ListItem[]
```
For example, you want to skip `timestamp` GET-parameter, `randomToken` and nested `data.wuid` POST-parameters. Then, you need to construct two lists, and set them to mocker options:

```ts
const dynamicQueryParams = [
  'timestamp'
]
const dynamicBodyParams = [
  'randomToken',
  ['data', 'wuid']
]

mocker.start({
  naming: {
    query: {
      blacklist: dynamicQueryParams
    },
    body: {
      blacklist: dynamicBodyParams
    }
  }
})
```
Now, when you have a POST request with url and body:
```
http://example.com/?foo=bar&timestamp=123

{
  randomToken: 'qweasd',
  data: {
    alice: 'bob',
    wuid: 32
  }
}
```
the mock filename will be exact as if it were just
```
http://example.com/?foo=bar

{
  data: {
    alice: 'bob'
  }
}
```

It is not recommended to use `whitelist`, because you may encounting mocks filenames collision. But in some rare cases (for example, when some keys are random) `whitelist` could be usefull.

It is not possible to use different lists for different urls simultaneously, but if you really need that, just create an issue!

## API methods

## mocker.start()

Starts the mocker. Mocks for all requests matched `options.capture` will be used, but no mocks used before `mocker.start()` and after `mocker.stop()`

Both `mocker.start()` and `mocker.stop()` return a `Promise`.

## mocker.mock(...)

Sometimes it is more convenient to set mocks right in tests, without storing them to the file system. For that cases mocker.mock method exist.

Example:
```js
mocker.mock(filter, response)
```
After that line, all request, matched `filter`, will be mocked with `response`.

> Note: latter `mocker.mock` filters have higher priority.
