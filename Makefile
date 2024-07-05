.PHONY: init
init:
	pnpm install

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
	pnpm prettier packages --write
	pnpm lerna run format

.PHONY: check-format
check-format:
	pnpm prettier packages --check
	pnpm lerna run check-format

.PHONY: bump-version
bump-version:
	pnpm lerna version --force-publish --no-private --no-git-tag-version

.PHONY: publish
publish: check-format build test
	pnpm publish --access public --filter=@lefun/*
