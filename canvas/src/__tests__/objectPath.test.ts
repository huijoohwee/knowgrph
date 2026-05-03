import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getObjectPath, setObjectPath } from '@/lib/data/objectPath'

export const testObjectPathReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'data', 'objectPath.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected object-path helper to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const base: Record<string, unknown> = isPlainObject(cur) ? { ...(cur as Record<string, unknown>) } : {}')) {
    throw new Error('expected object-path setter to reuse the shared plain-object guard for object writes')
  }
  if (text.includes("cur && typeof cur === 'object' && !Array.isArray(cur) ? { ...(cur as Record<string, unknown>) } : {}")) {
    throw new Error('expected object-path helper to stop coercing objects inline')
  }
}

export const testObjectPathSetAndGetNestedValues = () => {
  const base = { alpha: { beta: 1 }, list: [{ name: 'first' }] }
  const next = setObjectPath(base, 'alpha.gamma', 2)
  const nextList = setObjectPath(next, 'list[0].name', 'updated')
  if (getObjectPath(nextList, 'alpha.beta') !== 1) {
    throw new Error('expected existing nested object-path values to be preserved')
  }
  if (getObjectPath(nextList, 'alpha.gamma') !== 2) {
    throw new Error('expected nested object-path set to add the new key')
  }
  if (getObjectPath(nextList, 'list[0].name') !== 'updated') {
    throw new Error('expected array-backed object-path set to preserve behavior')
  }
}
