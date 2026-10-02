/** Cordis plugin entry for ToneClaw's Feishu long-connection ingress. */

import { EventDispatcher, LoggerLevel, WSClient } from '@larksuiteoapi/node-sdk'
import { normalizeIngressConfig, type IngressLoggerLevel } from './config.ts'
import { createFeishuLongConnection, type FeishuLongConnectionSdk } from './ingress.ts'
import type { IngressContext } from './types.ts'

export const name = 'feishu-long-connection'
export const inject = ['webhookRuntime', 'credentials']

const LOGGER_LEVELS = {
  fatal: LoggerLevel.fatal,
  error: LoggerLevel.error,
  warn: LoggerLevel.warn,
  info: LoggerLevel.info,
  debug: LoggerLevel.debug,
  trace: LoggerLevel.trace,
} as const satisfies Record<IngressLoggerLevel, number>

/** Register the Feishu WebSocket ingress on a dsh plugin context. */
export function apply(ctx: IngressContext, config: unknown): () => void {
  const normalized = normalizeIngressConfig(config)
  const sdk: FeishuLongConnectionSdk = { EventDispatcher, WSClient, LoggerLevel: LOGGER_LEVELS }
  return createFeishuLongConnection(ctx, normalized, sdk)
}
