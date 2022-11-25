.PHONY: ts
ts:
	rm -r dist || true
	npm run build

.PHONY: pretty-write
pretty-write:
	yarn prettier --write src/**/*.ts

.PHONY: pretty-check
pretty-check:
	yarn prettier --check src/**/*.ts

.PHONY: test
test:
	NODE_OPTIONS="--unhandled-rejections=strict" yarn jest
	NODE_OPTIONS="--unhandled-rejections=strict" yarn playwright test

.PHONY: prepare
prepare: ts pretty-write
	$(MAKE) test

.PHONY: ci
ci: ts pretty-check
	$(MAKE) test
