import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

const normalizeTestDataBasename = (filename: string): string => {
  const name = String(filename || '').trim()
  if (!name || name !== path.basename(name) || name.includes('/') || name.includes('\\')) {
    throw new Error(`expected repo test-data basename, got ${filename}`)
  }
  return name
}

export const resolveRepoTestDataPath = (filename: string): string =>
  path.join(repoRoot, 'data', 'test-data', normalizeTestDataBasename(filename))
