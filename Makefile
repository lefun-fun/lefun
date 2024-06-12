.PHONY: build
build:
	pnpm lerna run build

.PHONY: test
test:
	pnpm lerna run test

.PHONY: format
format:
	pnpm lerna run format

.PHONY: bump-version
bump-version:
	pnpm lerna version --force-publish

.PHONY: publish
publish:
	pnpm publish --access public --filter=!lefun-root
