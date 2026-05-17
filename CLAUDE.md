# lefun SDK

Necessary libraries to build games at [lefun.fun][0] .

## Repo structure

This is a pnpm mono repo.
We use typescript.

The main packages are in `packages/<name>`.

Test games at `games/<game>`

## Checks

You can run these checks are the root when you want to make sure everything is ok.

### Fixable linting

```sh
make fix
```

### Check linting, types, etc

```sh
make check
```

### Test

```sh
make test
```

### Building

```sh
make build
```

[0]: https://lefun.fun
