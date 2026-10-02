# ToneClaw product architecture

ToneClaw is a product composition over the DeepSeek Harness engine. The two
repositories have different ownership boundaries:

```text
deepseek-harness/    engine fork: runtime, sessions, agents, tools, host
toneclaw-product/    product layer: SDKs, adapters, business skills, assets
```

## Ownership

### Engine fork

`deepseek-harness` owns the generic runtime and dsh-idiomatic extensions:

- plugin loader and lifecycle
- Session, Agent, tool, approval, and permission machinery
- webhook runtime and session/event seams
- generic Feishu channel protocol logic (rule, continuity, reply pump)
- desktop host and the generic packaging machinery

Engine changes must satisfy dsh repository gates. Product-specific SDKs do not
belong there.

### Product layer

`toneclaw-product` owns ToneClaw-specific code and release composition:

- transports that require vendor SDKs, such as Feishu long connection
- TikTok Shop and Amazon SP-API product adapters
- cross-border ecommerce skills and prompts
- ToneClaw configuration, resources, and desktop release composition
- product-level integration tests and release checks

Product packages must not add a build-time dependency on `@deepseek-ai/*`.
They communicate with the engine through injected Cordis services and stable
delivery/event contracts.

## Current Feishu boundary

```text
Feishu WebSocket
  └─ @toneclaw/feishu-long-connection
       └─ verified feishu delivery
            └─ dsh webhook runtime
                 └─ @deepseek-ai/dsh-webhook-feishu
                      ├─ trusted rule
                      ├─ chat/session continuity
                      └─ outbound reply pump
```

The transport owns connection, authentication, reconnect, and event projection.
The channel owns rule validation, deduplication, Session continuity, and reply
pumping. Neither side should absorb the other's responsibility.

## Engine pinning

`engine-lock.json` records the exact supported `deepseek-harness` commit. A
product integration check compares this lock against the local engine checkout.
Update the lock only with an intentional engine upgrade and after running both
repositories' checks.

## Release composition

A desktop release is not just the engine build. It is the composition of:

1. the pinned dsh engine and desktop host,
2. built product packages,
3. their production dependency closure,
4. a generated product profile that references deployed resources by relative
   path rather than a developer's absolute checkout path.

Development may use sibling checkouts for fast iteration. Release artifacts must
not contain absolute developer paths.
