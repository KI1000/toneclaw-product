# ToneClaw product packages

Product-owned packages for ToneClaw. These packages may depend on external
product SDKs; the DeepSeek Harness fork stays free of those implementation
details.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the engine/product ownership model.
The supported engine commit is recorded in `engine-lock.json`; verify a sibling
checkout with `pnpm check:engine-lock`.

## Release transport

Build a deployable transport and generated desktop patch:

```sh
pnpm run package:transport
```

Output:

```text
release/feishu-long-connection/   runtime package + production node_modules
release/profiles/desktop.patch.yml  dsh patch with a relative plugin path
```

The generated patch contains no developer checkout paths. Deploy the release
directory and patch together, preserving their sibling relationship, or pass
`--plugin` / `--out` to `scripts/generate-profile.mjs` when your installer uses
a different resource layout.

## Packages

- [`@toneclaw/feishu-long-connection`](packages/feishu-long-connection/README.md) —
  Feishu WebSocket ingress that dispatches verified deliveries to dsh.
