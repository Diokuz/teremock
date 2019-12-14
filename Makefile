.PHONY: prepare
prepare:
	yarn pnpify tsc
	yarn prettier --write tests/**/*.js
	yarn prettier --write src/**/*.ts
	yarn jest
