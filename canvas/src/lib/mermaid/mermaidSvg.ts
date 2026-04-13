import { LRUCache } from '@/lib/cache/LRUCache'
import { hashText } from '@/features/parsers/hash'
import { cleanupMermaidRenderArtifacts, ensureMermaidInitialized, ensureStandardMermaidInitialized, loadMermaidRuntimeApi } from '@/lib/mermaid/mermaidRuntime'

type MermaidTheme = 'light' | 'dark'
type MermaidSvgProfile = 'default' | 'plain'

type MermaidRenderResult = {
  svg: string
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

const renderMermaidSvgCachedWithProfile = async (args: {
  code: string
  theme: MermaidTheme
  profile: MermaidSvgProfile
}): Promise<MermaidRenderResult> => {
  const code = String(args.code || '').trim()
  if (!code) return { svg: '' }
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
    if (profile === 'plain') {
      await ensureStandardMermaidInitialized({
        ...baseConfig,
        flowchart: {
          htmlLabels: false,
        },
      })
    } else {
      await ensureMermaidInitialized(baseConfig, code)
    }
    const mermaid = await loadMermaidRuntimeApi()

    const id = `kg-mermaid-${hashText(`${profile}|${theme}|${code}`).slice(0, 16)}`
    cleanupMermaidRenderArtifacts(id)
    const out = await mermaid.render(id, code)
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
