# lefun SDK

Libraries to build games for [lefun.fun][0].

## Repo structure

A pnpm monorepo, in TypeScript.

- `packages/<name>`: the published `@lefun/*` packages.
- `games/<game>`: test games built with them.

## Checks

From the root:

```sh
make fix    # eslint --fix, prettier
make check  # eslint, prettier, tsc
make build
make test   # vitest
```

For a single package: `cd packages/<name> && pnpm test`.

The packages import each other through their built `dist`, so tests and type checks
of a package run against the last build of its dependencies. After changing a
package, build it (or `make build`) before checking anything that depends on it.

[0]: https://lefun.fun
