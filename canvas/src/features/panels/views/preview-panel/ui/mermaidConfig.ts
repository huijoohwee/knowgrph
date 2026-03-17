import React from 'react'
import type { MarkdownFrontmatter } from '@/lib/markdown'

export type MermaidInitConfig = Record<string, unknown>

const safeJsonParseObject = (raw: string): Record<string, unknown> | null => {
  try {
    const val = JSON.parse(raw)
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null
    return val as Record<string, unknown>
  } catch {
    return null
  }
}

export const parseMermaidConfigFromFrontmatter = (meta: MarkdownFrontmatter): MermaidInitConfig | null => {
  const raw = String(meta.mermaidConfig || '').trim()
  if (raw) {
    const parsed = safeJsonParseObject(raw)
    if (parsed) return parsed
  }
  const theme = String(meta.mermaidTheme || '').trim()
  const varsRaw = String(meta.mermaidThemeVariables || '').trim()
  const themeVariables = varsRaw ? safeJsonParseObject(varsRaw) : null
  const config: MermaidInitConfig = {}
  if (theme) config.theme = theme
  if (themeVariables) config.themeVariables = themeVariables
  return Object.keys(config).length ? config : null
}

export const useRootThemeMode = (): 'light' | 'dark' => {
  const readMode = (): 'light' | 'dark' => {
    if (typeof document === 'undefined') return 'light'
    const el = document.documentElement
    const attr = el.getAttribute('data-theme')
    if (attr === 'dark') return 'dark'
    if (attr === 'light') return 'light'
    try {
      if (el.classList.contains('dark')) return 'dark'
    } catch {
      void 0
    }
    return 'light'
  }
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => {
    return readMode()
  })
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const apply = () => setMode(readMode())
    apply()
    const Global = globalThis as unknown as { MutationObserver?: typeof MutationObserver }
    const ObserverCtor = Global.MutationObserver
    if (!ObserverCtor) return
    const obs = new ObserverCtor(apply)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])
  return mode
}
