import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'

export const CANONICAL_AGENT_DEFINITIONS_DOCUMENT_PATH = 'agentic-canvas-os/docs/AGENT-DEFINITIONS.md'
const CANONICAL_AGENT_DEFINITIONS_SHARE_PATH = `/knowgrph/share/${encodePublishedDocShareToken({
  canonicalPath: CANONICAL_AGENT_DEFINITIONS_DOCUMENT_PATH,
})}`
const LOCAL_RUNTIME_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

export const CANONICAL_AGENT_DEFINITIONS_CANVAS_EMBED_URL = `https://airvio.co${CANONICAL_AGENT_DEFINITIONS_SHARE_PATH}?kgCanvasSurfaceMode=2d&kgCanvasRenderMode=2d&kgCanvas2dRenderer=storyboard&openEditorWorkspace=1`

export function resolveCanonicalAgentDefinitionsCanvasEmbedRuntimeUrl(runtimeOrigin?: string | null): string {
  const rawOrigin = String(runtimeOrigin || (typeof window !== 'undefined' ? window.location?.origin : '') || '').trim()
  if (!rawOrigin) return CANONICAL_AGENT_DEFINITIONS_CANVAS_EMBED_URL
  try {
    const origin = new URL(rawOrigin)
    if (!LOCAL_RUNTIME_HOSTS.has(origin.hostname.toLowerCase())) return CANONICAL_AGENT_DEFINITIONS_CANVAS_EMBED_URL
    const embed = new URL(CANONICAL_AGENT_DEFINITIONS_CANVAS_EMBED_URL)
    embed.protocol = origin.protocol
    embed.host = origin.host
    return embed.toString()
  } catch {
    return CANONICAL_AGENT_DEFINITIONS_CANVAS_EMBED_URL
  }
}

export function normalizeLiveCanvasHeroCanvasEmbedUrl(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const supportedOrigin = url.origin === 'https://airvio.co' || LOCAL_RUNTIME_HOSTS.has(url.hostname.toLowerCase())
    if (!supportedOrigin || url.pathname !== CANONICAL_AGENT_DEFINITIONS_SHARE_PATH) return raw
    url.searchParams.delete('kgPreview')
    url.searchParams.delete('kgLiveHero')
    url.searchParams.set('kgCanvasSurfaceMode', '2d')
    url.searchParams.set('kgCanvasRenderMode', '2d')
    url.searchParams.set('kgCanvas2dRenderer', 'storyboard')
    url.searchParams.set('openEditorWorkspace', '1')
    const runtimeOrigin = typeof window !== 'undefined' ? String(window.location?.origin || '').trim() : ''
    if (runtimeOrigin) {
      const runtime = new URL(runtimeOrigin)
      if (LOCAL_RUNTIME_HOSTS.has(runtime.hostname.toLowerCase())) {
        url.protocol = runtime.protocol
        url.host = runtime.host
      }
    }
    return url.toString()
  } catch {
    return raw
  }
}
