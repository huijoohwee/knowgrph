import { hashString32, hashStringToHex } from './stringHash.js'

type SignaturePrimitive = string | number | boolean | null | undefined

const normalizePrimitive = (value: SignaturePrimitive): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return String(value)
}

export const buildSignatureText = (parts: SignaturePrimitive[]): string => (
  parts.map(normalizePrimitive).join('|')
)

export const hashSignatureParts = (parts: SignaturePrimitive[]): string => (
  hashStringToHex(buildSignatureText(parts))
)

export const hashSignatureParts32 = (parts: SignaturePrimitive[]): number => (
  hashString32(buildSignatureText(parts))
)
