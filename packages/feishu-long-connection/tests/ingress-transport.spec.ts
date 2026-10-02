import { describe, expect, it, vi, type Mock } from 'vitest'
import { normalizeIngressConfig } from '../src/config.ts'
import {
  createFeishuLongConnection,
  type EventDispatcherLike,
  type FeishuEventData,
  type FeishuLongConnectionSdk,
  type WSClientLike,
} from '../src/ingress.ts'
import type { FeishuDelivery, IngressContext } from '../src/types.ts'

const LOGGER_LEVEL = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 }
const config = normalizeIngressConfig({
  source: 'primary-feishu',
  appIdEnv: 'DSH_FEISHU_APP_ID',
  appSecretEnv: 'DSH_FEISHU_APP_SECRET',
  consoleArrival: false,
})

interface Harness {
  readonly ctx: IngressContext
  readonly deliveries: FeishuDelivery[]
  readonly logger: { debug: Mock; info: Mock; warn: Mock }
  readonly client: WSClientLike & {
    start: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }
  readonly dispatcher: EventDispatcherLike
  readonly clientOptions: Record<string, unknown>
  emit: (data: FeishuEventData) => undefined
  dispose: () => void
}

function context(credentialValue: string | undefined = 'credential-value'): {
  ctx: IngressContext
  deliveries: FeishuDelivery[]
  logger: { debug: Mock; info: Mock; warn: Mock }
} {
  const deliveries: FeishuDelivery[] = []
  const logger = {
    debug: vi.fn(function logDebug(...args: unknown[]) { void args }),
    info: vi.fn(function logInfo(...args: unknown[]) { void args }),
    warn: vi.fn(function logWarn(...args: unknown[]) { void args }),
  }
  return {
    deliveries,
    logger,
    ctx: {
      logger,
      webhookRuntime: {
        dispatch: vi.fn((delivery: FeishuDelivery) => {
          deliveries.push(delivery)
        }),
      },
      credentials: {
        resolve: vi.fn(async (reference: string) => {
          return { value: credentialValue }
        }),
      },
    effect: () => {
      throw new Error('replaced by harness')
    },
  },
  }
}

function harness(options: {
  credentialValue?: string
  start?: WSClientLike['start']
  close?: WSClientLike['close']
} = {}): Harness {
  const { ctx, deliveries, logger } = context(options.credentialValue)
  let registered: Record<string, (data: FeishuEventData) => undefined> | undefined
  const dispatcher: EventDispatcherLike = {
    register: vi.fn((handles) => {
      registered = handles
      return dispatcher
    }),
  }
  const clientOptions: Record<string, unknown> = {}
  const client: Harness['client'] = {
    start: vi.fn(options.start ?? (async () => undefined)),
    close: vi.fn(options.close ?? (async () => undefined)),
  }
  const sdk: FeishuLongConnectionSdk = {
    LoggerLevel: LOGGER_LEVEL,
    EventDispatcher: vi.fn(function EventDispatcherMock() {
      return dispatcher
    }) as unknown as FeishuLongConnectionSdk['EventDispatcher'],
    WSClient: vi.fn(function WSClientMock(instanceOptions) {
      Object.assign(clientOptions, instanceOptions)
      return client
    }) as unknown as FeishuLongConnectionSdk['WSClient'],
  }
  let dispose = () => {}
  const ctxWithEffect: IngressContext = Object.assign(ctx, {
    effect: (setup: () => () => void) => {
      dispose = setup()
      return dispose
    },
  })
  dispose = createFeishuLongConnection(ctxWithEffect, config, sdk)
  return {
    ctx,
    deliveries,
    logger,
    client,
    dispatcher,
    clientOptions,
    emit: (data) => registered?.['im.message.receive_v1']?.(data),
    dispose,
  }
}

function messageEvent(overrides: FeishuEventData = {}): FeishuEventData {
  return {
    event_id: 'evt-1',
    event_type: 'im.message.receive_v1',
    token: 'ws-token',
    sender: { sender_id: { open_id: 'ou-sender' } },
    message: { chat_id: 'oc-chat', chat_type: 'group', message_type: 'text' },
    ...overrides,
  }
}

describe('Feishu long connection', () => {
  it('resolves credentials, starts an auto-reconnecting client, and projects events', async () => {
    const test = harness()
    await vi.waitFor(() => expect(test.dispatcher.register).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(test.client.start).toHaveBeenCalledOnce())
    expect(test.clientOptions).toMatchObject({
      appId: 'credential-value',
      appSecret: 'credential-value',
      loggerLevel: 3,
      autoReconnect: true,
      source: 'toneclaw',
    })
    test.emit(messageEvent())
    expect(test.deliveries).toHaveLength(1)
    expect(test.deliveries[0]).toMatchObject({
      kind: 'feishu',
      source: 'primary-feishu',
      deliveryId: 'evt-1',
      event: {
        name: 'im.message.receive_v1',
        payload: {
          schema: '2.0',
          header: {
            event_id: 'evt-1',
            event_type: 'im.message.receive_v1',
            token: 'ws-token',
          },
          event: {
            message: { chat_id: 'oc-chat' },
          },
        },
      },
    })
  })

  it('rejects events without a stable event id or object message', async () => {
    const test = harness()
    await vi.waitFor(() => expect(test.dispatcher.register).toHaveBeenCalledOnce())
    test.emit(messageEvent({ event_id: undefined }))
    test.emit(messageEvent({ event_id: '' }))
    test.emit(messageEvent({ message: undefined }))
    expect(test.deliveries).toEqual([])
    expect(test.ctx.logger.warn).toHaveBeenCalledTimes(3)
  })

  it('logs metadata only and keeps the message body out of logs', async () => {
    const test = harness()
    await vi.waitFor(() => expect(test.dispatcher.register).toHaveBeenCalledOnce())
    test.emit(messageEvent({
      message: { chat_id: 'oc-chat', chat_type: 'p2p', message_type: 'text', content: '{"text":"secret"}' },
    }))
    const logged = JSON.stringify(test.logger.info.mock.calls)
    expect(logged).toContain('oc-chat')
    expect(logged).not.toContain('secret')
    expect(JSON.stringify(test.logger.warn.mock.calls)).not.toContain('secret')
  })

  it('does not connect when a credential is unavailable', async () => {
    const test = harness({ credentialValue: '' })
    await vi.waitFor(() => expect(test.ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('start failed')))
    expect(test.client.start).not.toHaveBeenCalled()
  })

  it('closes the client on dispose and ignores events after disposal', async () => {
    const test = harness()
    await vi.waitFor(() => expect(test.client.start).toHaveBeenCalledOnce())
    test.dispose()
    expect(test.client.close).toHaveBeenCalledOnce()
  })

  it('logs but does not throw when runtime dispatch throws synchronously', async () => {
    const test = harness()
    await vi.waitFor(() => expect(test.dispatcher.register).toHaveBeenCalledOnce())
    ;(test.ctx.webhookRuntime.dispatch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('runtime unavailable')
    })
    expect(() => test.emit(messageEvent())).not.toThrow()
    expect(test.ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('runtime unavailable'))
  })
})
