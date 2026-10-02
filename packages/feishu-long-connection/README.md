# @toneclaw/feishu-long-connection

ToneClaw's Feishu WebSocket ingress. It authenticates with the official Feishu
SDK's long-connection client, receives `im.message.receive_v1` events, projects
each accepted event into dsh's verified `feishu` delivery shape, and hands it to
`ctx.webhookRuntime.dispatch()`.

This package deliberately owns transport only. Session creation, event-rule
validation, deduplication, chat continuity, and outbound replies belong to
`@deepseek-ai/dsh-webhook-feishu`.

## Configuration

| Key | Required | Meaning |
|---|---|---|
| `source` | yes | Non-empty adapter source passed to the delivery and owning rule. |
| `appIdEnv` | yes | Credential reference containing the Feishu app id. |
| `appSecretEnv` | yes | Credential reference containing the Feishu app secret. |
| `loggerLevel` | no | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace`; default `info`. |
| `consoleArrival` | no | Also write metadata-only arrival lines to process stdout; default `true`. |

Events without a non-empty `event_id` or an object `message` are rejected. No
message text is logged.

## Build and check

```sh
pnpm install
pnpm check
```

The build emits an ESM plugin under `dist/`. Deploy it together with its
production `node_modules` (or as a pnpm-deployed package), so the Feishu SDK and
runtime dependencies resolve without a development source tree.
