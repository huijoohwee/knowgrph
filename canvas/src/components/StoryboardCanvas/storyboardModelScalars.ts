import { splitMultiValues } from '@/features/markdown/ui/markdownDataViewValueUtils'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'

export const normalizeStoryboardText = (value: unknown): string => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

export const toStoryboardTitleCase = (value: string): string => {
  const normalized = normalizeStoryboardText(value)
  if (!normalized) return ''
  return normalized
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_.:/-]+/)
    .filter(Boolean)
    .map(token => /^[A-Z\d]{2,}$/.test(token) ? token : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

export const readStoryboardString = (value: unknown): string => {
  const scalar = unwrapGraphCellValue(value)
  if (typeof scalar === 'string' || typeof scalar === 'number' || typeof scalar === 'boolean') {
    return normalizeStoryboardText(scalar)
  }
  return ''
}

export const readStoryboardStringList = (value: unknown): string[] => {
  const scalar = unwrapGraphCellValue(value)
  if (!Array.isArray(scalar)) {
    const text = readStoryboardString(scalar)
    return text ? splitMultiValues(text) : []
  }
  return scalar.map(readStoryboardString).filter(Boolean)
}

export const readStoryboardNumber = (value: unknown): number | null => {
  const scalar = unwrapGraphCellValue(value)
  if (typeof scalar === 'number' && Number.isFinite(scalar)) return scalar
  if (typeof scalar !== 'string' || !scalar.trim()) return null
  const parsed = Number(scalar)
  return Number.isFinite(parsed) ? parsed : null
}
