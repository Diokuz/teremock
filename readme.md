# teremock

## Do I need teremock?

If you write puppeteer tests, and you want to mock your network responses easily – probably yes.

## How to use

```js
import mocker from 'teremock'

await mocker.start({ page })

// async stuff which is making requests, including redirects
```

## How it works

First, `teremock` intercepts puppeteers page requests and tries to find corresponding responses in files. Generated filename depends on request `url`, `method` and `body` – so, you always know, do you have a mock for that particular request or not. If you have it – you will get it as a response. If not – request will go to the real backend.

Second, `teremock` intercepts all responds, and writes them to the **filesystem**,

### or not.

Sometimes it is more convenient to set mocks right in tests, without storing them to the file system. For that cases mocker.add method exist.

Example:
```js
mocker.add(interceptor)
```
After that line, all request, matched `interceptor`, will be mocked with `interceptor.response`.

> Note: dynamically added interceptors have priority over statically added interceptors. Also, latter `mocker.add` interceptors have higher priority. _See [interceptor](#interceptor) below_.


## options

```js
mocker.start(options)
```
All options are optional (that's why they called so), except `page`.

```js
const options = {
  // puppeteer page
  page: page,

  // Named list of request interceptors
  interceptors: {
    testpage: {
      url: 'localhost',
      pass: true
    },
    example_com_api: {
      url: 'example.com',
      methods: `get,post`,
    },
    my_another_api: {
      url: '/path/to/my/api',
    },
    option_requests: {
      methods: 'option',
      response: {
        headers: {
          'allow-origin': '*'
        }
      }
    },
    // it is recommended to have that interceptor
    all_other_requests: {
      middleware: () => ({ status: 500, body: 'request is not allowed!' })
    }
  },

  // Absolute path to working directory, where you want to store mocks
  // path.resolve(process.cwd(), '__teremocks__') by default
  wd: path.resolve(__dirname, '__teremocks__'),

  // Run as CI if true. In CI mode any non-passable request will not go to the real backend
  // Default is `is-ci` package value (same as in Jest library)
  ci: false,

  // Custom delay between request and response for mocked responses
  // Default value is 0
  ttfb: () => Math.random() * 1000
}
```

## Interceptor

Interceptor – is a big conception in `teremock`. Interceptor is an object, which have two different groups of properties:

1. Matcher group: these properties determine, whether to intercept particular request, or not.
2. Provider group: what to do with request: 1) pass to real backend 2) respond with inline resoponse 3) try to find response mock on file system.

Interceptor is used, if _all_ matchers are matched against request. So, if one matcher is not matched, given interceptor will not be used.

It is recommended to have interceptors for all possible (for your test app) requests. All non-covered requests will be aborted.

### Matcher group properties

#### interceptor.`url` [string]

A string, which defines urls to match. It works when `request.url.includes(url) === true` – so, `ample.com` will match both `http://exampe.com` and `https://not-example.com/api?foo-bar`. Note: prefer not to place query params to urls, because they could be randomly sorted in real request.

Default value: `*`.

#### interceptor.`resouceTypes` [string]

Comma-separated list of puppeteer [request resource types](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#requestresourcetype). By default, only `xhr` and `fetch` request are mockable, but there are many situation where you may want to mock html documents, js files and, for example, the whole page of the facebook auth.

Default value: `xhr,fetch`.

#### interceptor.`query` [Object]

Unsorted one-level object of query params. Missing params will not affect the interception. Example: `{ foo: 'bar' }` will match `<url>?foo=bar` as well as `<url>?alice=bob&foo=bar&baz=1`.

Duplicated values (e.g. `?foo=bar&foo=baz`) are not supported.

Default value: `{}`.

#### interceptor.`methods` [string]

Comma-separated list of http methods to be matched. Example: `get,post,put`.

Default value: `*`.

#### interceptor.`headers` [Object]

Unsorted one-level ignore-cased object of _request_ headers.

Default value: `{}`.

#### interceptor.`body` [Object]

Unsorted deep object to match request body.

Default value: `{}`.

### Provider group properties

#### interceptor.`pass` [boolean]

If `true`, pass request to the real backend. It is not recommended to pass any request outside of your app, since your tests became unstable and dependent from backends stability and network availability.

Default value: `false`.

#### interceptor.`response` [Object]

If present, it is used instead of file-based mocks. Usefull for testing different responses for the same request, and/or for mocking big-sized data.

Default value: `null`.

#### interceptor.`naming` [Object]

See [Change naming rules](#change naming rules) below.

[Interceptor examples](./examples/interceptors.js).

## Mock files naming

The name of mock file is consist of five parts:

#### 1. `options.wd` value

#### 2. named directory

Name will be taken from interceptor.name, or from the interceptor key, or from the hostname+path of request.url.

#### 3. lowercased http method

e.g. `post`

#### 4. query or three words

If request method is `get`, and query is short enough, it is used. Otherwise, three words are used. These words are pseudorandom, and depends on a) request url (without query) b) query params (sorted, deduped) c) body params (sorted).

#### 5. `.json` extension.

@todo examples

### Change naming rules

In many cases it is important to be independent from some query and body params, which, for example, have random value for each requests (e.g. timestamp). There are four different list for skipping some parameters, when calculating mock filename: whitelist and blacklist for query and body parameters.

For example, you want to skip `timestamp` GET-parameter, `randomToken` and nested `data.wuid` POST-parameters. Then, you need to construct two lists, and set them to mocker options:

```ts
const dynamicQueryParams = [
  'timestamp'
]
const dynamicBodyParams = [
  'randomToken',
  ['data', 'wuid']
]

const interceptor = {
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

### mocker.start()

Starts the mocker. Mocks for all requests matched `options.capture` will be used, but no mocks used before `mocker.start()` and after `mocker.stop()`

Both `mocker.start()` and `mocker.stop()` return a `Promise`.

### mocker.stop()

### mocker.add()
