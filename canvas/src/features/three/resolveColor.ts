import { resolveCssVar } from '@/lib/ui/theme-tokens'

export function resolveThreeColor(value: string | null | undefined, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  const m = raw.match(/var\(\s*(--[a-zA-Z0-9-_]+)\s*(?:,[^)]+)?\)/)
  if (m && m[1]) {
    return resolveCssVar(m[1], fallback)
  }
  if (raw.startsWith('--')) {
    return resolveCssVar(raw, fallback)
  }
  return raw
}

