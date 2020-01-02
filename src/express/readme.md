## Teremock for express

It is possible to use teremock without express. See example in `examples/teremock-express`.

### options

Two options added to original options:

### options.`env`

Key-value object, where `key` will be used to create routes of form `.../${key}`. All requests from test app must go through that route, instead of real backends. `Value` is just an url to the real backend.

### options.`app`

Express application, which will be used to add env-key-based routes, and proxy requests to real backends.

## Limitations

1. Only browsers with WebSocket are supported
2. Each browser instance needs its own server instance
3. (for now) no support for teremock.spy() method
