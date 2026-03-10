import { resolveCssVar } from '@/lib/ui/theme-tokens'
import { getKgThemeFromDom } from '@/lib/ui/tokens-ssot'

export function resolveThreeColor(value: string | null | undefined, fallback: string): string {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) return fallback
  const raw = (() => {
    const m = input.match(/var\(\s*(--[a-zA-Z0-9-_]+)\s*(?:,[^)]+)?\)/)
    if (m && m[1]) {
      const resolved = resolveCssVar(m[1], fallback)
      return resolved && resolved.trim() ? resolved.trim() : input
    }
    if (input.startsWith('--')) {
      const resolved = resolveCssVar(input, fallback)
      return resolved && resolved.trim() ? resolved.trim() : input
    }
    return input
  })()

  const themeKey = (() => {
    try {
      return typeof document !== 'undefined' ? getKgThemeFromDom() : 'ssr'
    } catch {
      return 'ssr'
    }
  })()

  const cacheKey = `${themeKey}|${raw}`
  const anyGlobal = globalThis as unknown as { __kgThreeColorCache?: Map<string, string>; __kgThreeColorProbeEl?: HTMLSpanElement | null }
  if (!anyGlobal.__kgThreeColorCache) anyGlobal.__kgThreeColorCache = new Map()
  const cache = anyGlobal.__kgThreeColorCache
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const resolveViaCss = (): string | null => {
    if (typeof document === 'undefined') return null
    const body = document.body
    if (!body) return null
    if (!anyGlobal.__kgThreeColorProbeEl) {
      const el = document.createElement('span')
      el.setAttribute('aria-hidden', 'true')
      el.style.position = 'absolute'
      el.style.left = '-99999px'
      el.style.top = '-99999px'
      el.style.width = '1px'
      el.style.height = '1px'
      el.style.overflow = 'hidden'
      el.style.pointerEvents = 'none'
      el.style.visibility = 'hidden'
      el.style.contain = 'layout paint'
      anyGlobal.__kgThreeColorProbeEl = el
      try {
        body.appendChild(el)
      } catch {
        anyGlobal.__kgThreeColorProbeEl = null
      }
    }
    const el = anyGlobal.__kgThreeColorProbeEl
    if (!el) return null
    try {
      el.style.color = ''
      el.style.color = raw
      if (!el.style.color) return null
      const computed = getComputedStyle(el).color
      if (!computed || !computed.trim()) return null
      return computed.trim()
    } catch {
      return null
    }
  }

  const resolved = resolveViaCss() || raw
  cache.set(cacheKey, resolved)
  return resolved
}
