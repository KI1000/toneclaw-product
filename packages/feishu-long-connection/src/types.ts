/** Minimal structural types for the Cordis context supplied by dsh. */

export interface IngressLogger {
  debug?(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
}

export interface IngressCredential {
  readonly value?: string
}

export interface FeishuDelivery {
  readonly kind: 'feishu'
  readonly source: string
  readonly deliveryId: string
  readonly event: {
    readonly name: typeof MESSAGE_EVENT
    readonly payload: {
      readonly schema: '2.0'
      readonly header: {
        readonly event_id: string
        readonly event_type: string
        readonly token: string
      }
      readonly event: {
        readonly sender: unknown
        readonly message: Record<string, unknown>
      }
    }
  }
  readonly receivedAt: number
}

export interface IngressContext {
  effect<T>(setup: () => T): T
  readonly logger: IngressLogger
  readonly webhookRuntime: {
    dispatch(delivery: FeishuDelivery): unknown
  }
  readonly credentials: {
    resolve(reference: string): Promise<IngressCredential | undefined>
  }
}

export type MessageEventType = typeof MESSAGE_EVENT
export const MESSAGE_EVENT = 'im.message.receive_v1' as const
