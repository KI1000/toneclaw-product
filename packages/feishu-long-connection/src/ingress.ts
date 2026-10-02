/** Feishu WebSocket transport projected into dsh's webhook runtime. */

import { MESSAGE_EVENT, type FeishuDelivery, type IngressContext } from './types.ts'
import type { NormalizedIngressConfig } from './config.ts'

export interface SdkLoggerLevelEnum {
  readonly fatal: number
  readonly error: number
  readonly warn: number
  readonly info: number
  readonly debug: number
  readonly trace: number
}

export interface FeishuEventData {
  readonly event_id?: unknown
  readonly event_type?: unknown
  readonly token?: unknown
  readonly sender?: unknown
  readonly message?: unknown
}

export interface EventDispatcherLike {
  register(handles: Record<string, (data: FeishuEventData) => undefined>): unknown
}

export interface WSClientLike {
  start(options: { readonly eventDispatcher: EventDispatcherLike }): unknown
  close?(): unknown
}

export interface FeishuLongConnectionSdk {
  readonly LoggerLevel: SdkLoggerLevelEnum
  readonly EventDispatcher: new (options: {
    readonly loggerLevel: number
  }) => EventDispatcherLike
  readonly WSClient: new (options: {
    readonly appId: string
    readonly appSecret: string
    readonly loggerLevel: number
    readonly autoReconnect: boolean
    readonly source: string
    readonly onReady: () => void
    readonly onError: (error: Error) => void
    readonly onReconnecting: () => void
    readonly onReconnected: () => void
  }) => WSClientLike
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function normalizeDelivery(
  config: NormalizedIngressConfig,
  data: FeishuEventData,
): { readonly delivery?: FeishuDelivery; readonly reason?: string } {
  if (!nonEmptyString(data.event_id)) {
    return { reason: 'event_id was absent or empty' }
  }
  if (!isRecord(data.message)) {
    return { reason: 'message was absent or not an object' }
  }
  return {
    delivery: Object.freeze({
      kind: 'feishu',
      source: config.source,
      deliveryId: data.event_id,
      event: Object.freeze({
        name: MESSAGE_EVENT,
        payload: Object.freeze({
          schema: '2.0',
          header: Object.freeze({
            event_id: data.event_id,
            event_type: nonEmptyString(data.event_type) ? data.event_type : MESSAGE_EVENT,
            token: nonEmptyString(data.token) ? data.token : '',
          }),
          event: Object.freeze({
            sender: data.sender,
            message: Object.freeze(data.message),
          }),
        }),
      }),
      receivedAt: Date.now(),
    }),
  }
}

async function resolveCredential(
  ctx: IngressContext,
  reference: string,
  subject: string,
): Promise<string> {
  const credential = await ctx.credentials.resolve(reference)
  if (credential === undefined || typeof credential.value !== 'string' || credential.value === '') {
    throw new Error(`feishu-long-connection: ${subject} credential ${JSON.stringify(reference)} is unavailable`)
  }
  return credential.value
}

/**
 * Create the ingress with injected SDK constructors so transport lifecycle and
 * event projection can be tested without opening a Feishu connection.
 */
export function createFeishuLongConnection(
  ctx: IngressContext,
  config: NormalizedIngressConfig,
  sdk: FeishuLongConnectionSdk,
): () => void {
  let client: WSClientLike | undefined
  let disposed = false

  function logArrival(data: FeishuEventData, deliveryId: string): void {
    const text = `received ${MESSAGE_EVENT} chat_type=${isRecord(data.message) ? String(data.message.chat_type ?? '?') : '?'} chat_id=${isRecord(data.message) ? String(data.message.chat_id ?? '?') : '?'} event_id=${deliveryId}`
    ctx.logger.info(`feishu-long-connection: ${text}`)
    if (config.consoleArrival) console.info(`[info]: [ 'feishu-long-connection' ] ${text}`)
  }

  function handleMessage(data: FeishuEventData): undefined {
    const { delivery, reason } = normalizeDelivery(config, data)
    if (delivery === undefined) {
      ctx.logger.warn(`feishu-long-connection: rejected ${MESSAGE_EVENT} event: ${reason}`)
      return undefined
    }
    logArrival(data, delivery.deliveryId)
    try {
      void Promise.resolve(ctx.webhookRuntime.dispatch(delivery)).catch((error: unknown) => {
        ctx.logger.warn(`feishu-long-connection: dispatch ${delivery.deliveryId} failed: ${String(error)}`)
      })
    } catch (error: unknown) {
      ctx.logger.warn(`feishu-long-connection: dispatch ${delivery.deliveryId} failed: ${String(error)}`)
    }
    return undefined
  }

  async function connect(): Promise<void> {
    const appId = await resolveCredential(ctx, config.appIdEnv, 'app id')
    const appSecret = await resolveCredential(ctx, config.appSecretEnv, 'app secret')
    if (disposed) return

    const dispatcher = new sdk.EventDispatcher({ loggerLevel: sdk.LoggerLevel[config.loggerLevel] })
    dispatcher.register({ [MESSAGE_EVENT]: handleMessage })
    client = new sdk.WSClient({
      appId,
      appSecret,
      loggerLevel: sdk.LoggerLevel[config.loggerLevel],
      autoReconnect: true,
      source: 'toneclaw',
      onReady: () => ctx.logger.info(`feishu-long-connection: ready (source ${config.source}, app ${appId})`),
      onError: (error) => ctx.logger.warn(`feishu-long-connection: failed: ${String(error)}`),
      onReconnecting: () => ctx.logger.info('feishu-long-connection: reconnecting'),
      onReconnected: () => ctx.logger.info('feishu-long-connection: reconnected'),
    })
    if (disposed) {
      await client.close?.()
      return
    }
    await client.start({ eventDispatcher: dispatcher })
  }

  return ctx.effect(() => {
    void connect().catch((error: unknown) => {
      ctx.logger.warn(`feishu-long-connection: start failed: ${String(error)}`)
    })
    return () => {
      disposed = true
      try {
        void client?.close?.()
      } catch (error: unknown) {
        ctx.logger.warn(`feishu-long-connection: close failed: ${String(error)}`)
      }
    }
  })
}
