.PHONY: all
all: fix check test

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

.PHONY: check
check:
	pnpm check

.PHONY: fix 
fix:
	pnpm fix

.PHONY: clean
clean:
	rm -rf dist; find . -name node_modules -exec rm -r {} \;

.PHONY: bump-version
bump-version:
	pnpm lerna version --force-publish --no-private --no-git-tag-version
	$(MAKE) fix

.PHONY: publish
publish: clean install build check test
	pnpm publish --access public --filter=@lefun/*
