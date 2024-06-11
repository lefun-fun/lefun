.PHONY: build
build:
	pnpm lerna run build

.PHONY: test
test:
	pnpm lerna run test

.PHONY: format
format:
	pnpm lerna run format

.PHONY: publish
publish:
	pnpm lerna version
	pnpm publish --access public
