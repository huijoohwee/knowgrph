import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashArrayOfObjectsSignature, hashRecordSignature, hashRecordSignature32 } from '@/lib/hash/signature'

export const testHashSignatureHelpersReuseSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'hash', 'signature.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected hash signature helpers to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected hash signature helpers to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const obj = readPlainObject(value)')) {
    throw new Error('expected record signature hashing to reuse the shared local plain-object helper')
  }
  if (!text.includes('const obj = readPlainObject(item)')) {
    throw new Error('expected array-of-objects signature hashing to reuse the shared local plain-object helper')
  }
  if (text.includes("value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null")) {
    throw new Error('expected hash signature helpers to stop coercing objects inline')
  }
}

export const testHashSignatureHelpersPreserveObjectHashingBehavior = () => {
  const recordHash = hashRecordSignature({ z: 1, a: 'x' })
  const recordHash32 = hashRecordSignature32({ z: 1, a: 'x' })
  const arrayHash = hashArrayOfObjectsSignature([{ z: 1, a: 'x' }, 'tail'])
  if (!recordHash || typeof recordHash !== 'string') {
    throw new Error('expected hashRecordSignature to return a non-empty string hash')
  }
  if (!Number.isFinite(recordHash32)) {
    throw new Error('expected hashRecordSignature32 to return a finite numeric hash')
  }
  if (!arrayHash || typeof arrayHash !== 'string') {
    throw new Error('expected hashArrayOfObjectsSignature to return a non-empty string hash')
  }
}
