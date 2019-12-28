.PHONY: ts
ts:
	rm -r dist
	cp -r src dist
	yarn pnpify tsc


.PHONY: prepare
prepare: ts
	yarn prettier --write tests/**/*.js
	yarn prettier --write src/**/*.ts
	yarn jest
