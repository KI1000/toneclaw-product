import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'release')
if (existsSync(target)) {
  for (const entry of readdirSync(target)) {
    rmSync(resolve(target, entry), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  } catch (error) {
    if (readdirSync(target).length > 0) throw error
  }
}
