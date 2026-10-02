import { describe, expect, it } from 'vitest'
import { normalizeIngressConfig } from '../src/config.ts'

const valid = {
  source: 'primary-feishu',
  appIdEnv: 'DSH_FEISHU_APP_ID',
  appSecretEnv: 'DSH_FEISHU_APP_SECRET',
}

describe('ingress config', () => {
  it('normalizes required fields and applies defaults', () => {
    expect(normalizeIngressConfig(valid)).toEqual({
      source: 'primary-feishu',
      appIdEnv: 'DSH_FEISHU_APP_ID',
      appSecretEnv: 'DSH_FEISHU_APP_SECRET',
      loggerLevel: 'info',
      consoleArrival: true,
    })
  })

  it.each([
    [{ ...valid, source: undefined }, /source/],
    [{ ...valid, source: ' primary' }, /source/],
    [{ ...valid, appIdEnv: '' }, /appIdEnv/],
    [{ ...valid, appIdEnv: ' APP_ID' }, /appIdEnv/],
    [{ ...valid, appSecretEnv: 1 }, /appSecretEnv/],
    [{ ...valid, loggerLevel: 'loud' }, /loggerLevel/],
    [{ ...valid, consoleArrival: 'yes' }, /consoleArrival/],
  ] as const)('rejects invalid config %#', (value, pattern) => {
    expect(() => normalizeIngressConfig(value)).toThrow(pattern)
  })

  it('rejects a null config', () => {
    expect(() => normalizeIngressConfig(null)).toThrow('config must be an object')
  })
})
