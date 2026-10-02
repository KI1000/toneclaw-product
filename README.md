# ToneClaw product packages

Product-owned packages for ToneClaw. These packages may depend on external
product SDKs; the DeepSeek Harness fork stays free of those implementation
details.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the engine/product ownership model.
The supported engine commit is recorded in `engine-lock.json`; verify a sibling
checkout with `pnpm check:engine-lock`.

## Packages

- [`@toneclaw/feishu-long-connection`](packages/feishu-long-connection/README.md) —
  Feishu WebSocket ingress that dispatches verified deliveries to dsh.
