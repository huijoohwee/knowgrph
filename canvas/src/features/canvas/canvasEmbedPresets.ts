const CANONICAL_WORKSPACE_README_SHARE_PATH = '/knowgrph/share/eyJjYW5vbmljYWxQYXRoIjoiaHVpam9vaHdlZS9kb2NzL3dvcmtzcGFjZS1yZWFkbWUubWQiLCJ3b3Jrc3BhY2VJZCI6bnVsbH0'

export const CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL = `https://airvio.co${CANONICAL_WORKSPACE_README_SHARE_PATH}?kgCanvasSurfaceMode=2d&kgCanvasRenderMode=2d&kgCanvas2dRenderer=storyboard`

export function normalizeCanonicalWorkspaceReadmeCanvasEmbedUrl(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.origin !== 'https://airvio.co' || url.pathname !== CANONICAL_WORKSPACE_README_SHARE_PATH) return raw
    url.searchParams.delete('kgPreview')
    url.searchParams.delete('kgLiveHero')
    url.searchParams.set('kgCanvasSurfaceMode', '2d')
    url.searchParams.set('kgCanvasRenderMode', '2d')
    url.searchParams.set('kgCanvas2dRenderer', 'storyboard')
    return url.toString()
  } catch {
    return raw
  }
}
