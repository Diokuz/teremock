## setup

`teremock` uses `yarn v2`, so

### 1. Switch to yarn v2

```
yarn policies set-version v2
```

### 2. Install dependencies

```
yarn
```

### 3. Typescript

#### 3.1. Compile

For now, we use `pnpify`, so, to compile sources, use

```
yarn pnpify tsc
```

#### 3.2. Typings for vscode

```
yarn pnpify --sdk
```

then

```
Press ctrl+shift+p in a TypeScript file
Choose "Select TypeScript Version"
Pick "Use Workspace Version"
```

[Official pnpify docs](https://next.yarnpkg.com/advanced/pnpify).

## `make prepare`

That command is a shortcut for the whole ci pipeline, so, use it right before you are ready to create merge request.
