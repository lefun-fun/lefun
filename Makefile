.PHONY: build
build:
	pnpm lerna run build

.PHONY: test
test:
	pnpm lerna run test

.PHONY: watch
watch:
	pnpm lerna run watch --stream --parallel

.PHONY: format
format:
	pnpm lerna run format

.PHONY: bump-version
bump-version:
	pnpm lerna version --force-publish

.PHONY: publish
publish: format build test
	pnpm publish --access public --filter=!lefun-root
