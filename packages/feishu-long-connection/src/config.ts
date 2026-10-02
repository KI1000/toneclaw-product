/** Validated configuration for the Feishu long-connection ingress. */

export interface NormalizedIngressConfig {
  readonly source: string
  readonly appIdEnv: string
  readonly appSecretEnv: string
  readonly loggerLevel: IngressLoggerLevel
  readonly consoleArrival: boolean
}

export type IngressLoggerLevel =
  | 'fatal'
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace'

export const INGRESS_LOGGER_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const satisfies readonly IngressLoggerLevel[]

export function requiredEnvironmentName(
  value: unknown,
  field: 'appIdEnv' | 'appSecretEnv',
): string {
  if (typeof value !== 'string' || value.trim() !== value || value === '') {
    throw new Error(`feishu-long-connection: ${field} must be a non-empty trimmed string`)
  }
  return value
}

export function normalizeIngressConfig(
  value: unknown,
  fallbackLoggerLevel: IngressLoggerLevel = 'info',
): NormalizedIngressConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('feishu-long-connection: config must be an object')
  }
  const config = value as Record<string, unknown>
  if (typeof config.source !== 'string' || config.source.trim() !== config.source || config.source === '') {
    throw new Error('feishu-long-connection: source must be a non-empty trimmed string')
  }
  const loggerLevel = config.loggerLevel ?? fallbackLoggerLevel
  if (!INGRESS_LOGGER_LEVELS.includes(loggerLevel as IngressLoggerLevel)) {
    throw new Error(`feishu-long-connection: loggerLevel must be one of ${INGRESS_LOGGER_LEVELS.join(', ')}`)
  }
  if (config.consoleArrival !== undefined && typeof config.consoleArrival !== 'boolean') {
    throw new Error('feishu-long-connection: consoleArrival must be a boolean when present')
  }
  return Object.freeze({
    source: config.source,
    appIdEnv: requiredEnvironmentName(config.appIdEnv, 'appIdEnv'),
    appSecretEnv: requiredEnvironmentName(config.appSecretEnv, 'appSecretEnv'),
    loggerLevel: loggerLevel as IngressLoggerLevel,
    consoleArrival: config.consoleArrival ?? true,
  })
}
