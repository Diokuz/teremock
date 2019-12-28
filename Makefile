.PHONY: ts
ts:
	yarn pnpify tsc


.PHONY: prepare
prepare: ts
	yarn prettier --write tests/**/*.js
	yarn prettier --write src/**/*.ts
	yarn jest
