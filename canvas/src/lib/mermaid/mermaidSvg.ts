import { LRUCache } from '@/lib/cache/LRUCache'
import { hashText } from '@/features/parsers/hash'

type MermaidTheme = 'light' | 'dark'

type MermaidRenderResult = {
  svg: string
}

const cache = new LRUCache<string, Promise<MermaidRenderResult>>(64)

let mermaidModulePromise: Promise<unknown> | null = null

const cleanupMermaidRenderArtifacts = (renderId: string): void => {
  const id = String(renderId || '').trim()
  if (!id || typeof document === 'undefined') return
  try {
    const wrapper = document.getElementById(`d${id}`)
    if (wrapper && wrapper.parentElement === document.body) wrapper.remove()
  } catch {
    void 0
  }
  try {
    const orphan = document.getElementById(id)
    if (orphan && orphan.parentElement === document.body) orphan.remove()
  } catch {
    void 0
  }
}

const loadMermaidModule = async (): Promise<unknown> => {
  if (!mermaidModulePromise) mermaidModulePromise = import('mermaid')
  return mermaidModulePromise
}

const normalizeSvg = (raw: string): string => {
  const s = String(raw || '')
  if (!s.trim()) return ''
  return s
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/^\s*<!doctype[^>]*>\s*/i, '')
    .trim()
}

const initMermaidOnce = (() => {
  let initialized = false
  let lastTheme: MermaidTheme | null = null
  return async (theme: MermaidTheme) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (initialized && lastTheme === theme) return
    const mod = await loadMermaidModule()
    const mermaid = (mod as unknown as { default?: unknown; initialize?: unknown; render?: unknown }).default || (mod as unknown)
    const initialize = (mermaid as unknown as { initialize?: (cfg: unknown) => void }).initialize
    if (typeof initialize === 'function') {
      initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'dark' ? 'dark' : 'default',
      })
    }
    initialized = true
    lastTheme = theme
  }
})()

export async function renderMermaidSvgCached(args: {
  code: string
  theme: MermaidTheme
}): Promise<MermaidRenderResult> {
  const code = String(args.code || '').trim()
  if (!code) return { svg: '' }
  const theme = args.theme === 'dark' ? 'dark' : 'light'
  const key = `${theme}|${hashText(code)}`
  const cached = cache.get(key)
  if (cached) return cached

  const promise = (async (): Promise<MermaidRenderResult> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { svg: '' }
    }
    await initMermaidOnce(theme)
    const mod = await loadMermaidModule()
    const mermaid = (mod as unknown as { default?: unknown; render?: unknown }).default || (mod as unknown)
    const render = (mermaid as unknown as {
      render?: (id: string, code: string) => Promise<{ svg: string } | string>
    }).render

    if (typeof render !== 'function') return { svg: '' }

    const id = `kg-mermaid-${hashText(`${theme}|${code}`).slice(0, 16)}`
    cleanupMermaidRenderArtifacts(id)
    const out = await render(id, code)
    cleanupMermaidRenderArtifacts(id)
    const svg = typeof out === 'string' ? out : String((out as { svg?: unknown }).svg || '')
    return { svg: normalizeSvg(svg) }
  })()

  cache.set(key, promise)
  try {
    return await promise
  } catch {
    cache.delete(key)
    return { svg: '' }
  }
}
