.PHONY: install
install:
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
	pnpm format

.PHONY:lint 
lint:
	pnpm lint

.PHONY: bump-version
bump-version:
	pnpm lerna version --force-publish --no-private --no-git-tag-version
	$(MAKE) format

.PHONY: publish
publish: check-format build test
	pnpm publish --access public --filter=@lefun/*
