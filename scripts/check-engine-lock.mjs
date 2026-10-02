import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(await readFile(resolve(root, 'engine-lock.json'), 'utf8'))
const expected = lock.engine

if (expected === undefined) throw new Error('engine-lock.json has no engine entry')
const engineDir = resolve(root, process.env.TONECLAW_ENGINE_DIR ?? '../deepseek-harness')
if (!existsSync(resolve(engineDir, '.git'))) {
  console.error(`engine lock check skipped: engine checkout not found at ${engineDir}`)
  console.error('set TONECLAW_ENGINE_DIR to run the full integration lock check')
  process.exit(0)
}

async function git(arguments_) {
  const { stdout } = await execFileAsync('git', arguments_, { cwd: engineDir })
  return stdout.trim()
}

const commit = await git(['rev-parse', 'HEAD'])
const branch = await git(['branch', '--show-current'])
const remote = await git(['remote', 'get-url', 'origin'])
const status = await git(['status', '--porcelain'])

const failures = []
if (commit !== expected.commit) {
  failures.push(`commit mismatch: expected ${expected.commit}, got ${commit}`)
}
if (branch !== expected.branch) {
  failures.push(`branch mismatch: expected ${expected.branch}, got ${branch || '<detached>'}`)
}
if (remote !== expected.remote) {
  failures.push(`origin mismatch: expected ${expected.remote}, got ${remote}`)
}
if (status !== '') {
  failures.push(`engine checkout is dirty:\n${status}`)
}

if (failures.length > 0) {
  console.error(`engine lock mismatch for ${engineDir}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('update engine-lock.json only after an intentional engine upgrade and full checks')
  process.exit(1)
}

console.log(`engine lock ok: ${expected.name}@${expected.commit} (${expected.branch})`)
