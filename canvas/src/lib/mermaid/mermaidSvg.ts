import { LRUCache } from '@/lib/cache/LRUCache'
import { hashText } from '@/features/parsers/hash'
import { renderMermaidWithRuntime } from '@/lib/mermaid/mermaidRuntime'
import { normalizeMermaidCodeForRuntime } from 'grph-shared/markdown/mermaidInput'

type MermaidTheme = 'light' | 'dark'
type MermaidSvgProfile = 'default' | 'plain'

type MermaidRenderResult = {
  svg: string
}

export type MermaidSvgPostprocessResult = {
  svg: string
  error: string | null
}

const cache = new LRUCache<string, Promise<MermaidRenderResult>>(64)

const normalizeSvg = (raw: string): string => {
  const s = String(raw || '')
  if (!s.trim()) return ''
  return s
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/^\s*<!doctype[^>]*>\s*/i, '')
    .trim()
}

export const sanitizeMermaidSvg = (raw: string): string => {
  const input = normalizeSvg(raw)
  if (!input || typeof window === 'undefined') return input
  try {
    const doc = new window.DOMParser().parseFromString(input, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || root.nodeName.toLowerCase() !== 'svg') return input
    const all = root.querySelectorAll('*')
    for (const el of Array.from(all)) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'script') {
        el.remove()
        continue
      }
      for (const name of el.getAttributeNames()) {
        if (name.toLowerCase().startsWith('on')) el.removeAttribute(name)
      }
      if (tag === 'a') {
        const href = String(el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim()
        if (href && href.startsWith('#')) continue
        el.removeAttribute('href')
        el.removeAttribute('xlink:href')
        el.removeAttribute('target')
        el.removeAttribute('rel')
      }
    }
    return new window.XMLSerializer().serializeToString(root)
  } catch {
    return input
  }
}

export const extractMermaidErrorFromSvg = (svg: string): string | null => {
  const raw = String(svg || '')
  if (!raw.trim()) return null
  const hasErrorRole = /aria-roledescription\s*=\s*"error"/i.test(raw)
  const hasErrorTextClass = /class\s*=\s*"[^"]*\berror-text\b[^"]*"/i.test(raw)
  if (!hasErrorRole && !hasErrorTextClass) return null
  const textMatches = Array.from(raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi))
  for (let i = 0; i < textMatches.length; i += 1) {
    const message = String(textMatches[i]?.[1] || '').replace(/\s+/g, ' ').trim()
    if (!message) continue
    if (/^mermaid version\s+/i.test(message)) continue
    return message
  }
  return 'Mermaid syntax error'
}

export const postprocessMermaidSvg = (raw: string): MermaidSvgPostprocessResult => {
  const svg = sanitizeMermaidSvg(raw)
  return {
    svg,
    error: extractMermaidErrorFromSvg(svg),
  }
}

const renderMermaidSvgCachedWithProfile = async (args: {
  code: string
  theme: MermaidTheme
  profile: MermaidSvgProfile
}): Promise<MermaidRenderResult> => {
  const trimmed = String(args.code || '').trim()
  if (!trimmed) return { svg: '' }
  const code = normalizeMermaidCodeForRuntime(trimmed)
  if (!code.trim()) return { svg: '' }
  const theme = args.theme === 'dark' ? 'dark' : 'light'
  const profile = args.profile
  const key = `${profile}|${theme}|${hashText(code)}`
  const cached = cache.get(key)
  if (cached) return cached

  const promise = (async (): Promise<MermaidRenderResult> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { svg: '' }
    }
    const baseConfig = {
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
    } as const
    const out = await renderMermaidWithRuntime({
      renderId: `kg-mermaid-${hashText(`${profile}|${theme}|${code}`).slice(0, 16)}`,
      code,
      config: profile === 'plain'
        ? {
        ...baseConfig,
        flowchart: {
          htmlLabels: false,
        },
      }
        : baseConfig,
      initStrategy: profile === 'plain' ? 'standard' : 'auto',
    })
    const processed = postprocessMermaidSvg(out.svg)
    return { svg: processed.svg }
  })()

  cache.set(key, promise)
  try {
    return await promise
  } catch {
    cache.delete(key)
    return { svg: '' }
  }
}

export async function renderMermaidSvgCached(args: {
  code: string
  theme: MermaidTheme
}): Promise<MermaidRenderResult> {
  return renderMermaidSvgCachedWithProfile({ ...args, profile: 'default' })
}

export async function renderPlainMermaidSvgCached(args: {
  code: string
  theme: MermaidTheme
}): Promise<MermaidRenderResult> {
  return renderMermaidSvgCachedWithProfile({ ...args, profile: 'plain' })
}
