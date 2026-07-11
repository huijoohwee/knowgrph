import { resolveLiveCanvasHeroEnterHref } from '@/lib/routing/basePath'

export function resolveLiveCanvasHeroEmbedUrl(args: {
  sourcePath: string
  selectedEmbedUrl?: string | null
  baseUrl?: string | null
  origin?: string | null
}): string | null {
  const selectedEmbedUrl = String(args.selectedEmbedUrl || '').trim()
  if (selectedEmbedUrl) {
    try {
      const selectedUrl = new URL(selectedEmbedUrl, String(args.origin || '').trim() || 'https://airvio.co')
      selectedUrl.searchParams.set('kgPreview', '1')
      selectedUrl.searchParams.set('kgLiveHero', '1')
      return selectedUrl.toString()
    } catch {
      return null
    }
  }

  const relativeSourcePath = String(args.sourcePath || '')
    .trim()
    .replace(/^workspace:/i, '')
    .replace(/^\/+/, '')
  if (!relativeSourcePath) return null

  const origin = String(args.origin || '').trim()
    || (typeof window !== 'undefined' ? String(window.location?.origin || '').trim() : '')
  if (!origin) return null

  try {
    const embedUrl = new URL(resolveLiveCanvasHeroEnterHref(args.baseUrl), origin)
    embedUrl.searchParams.set('kgDoc', relativeSourcePath)
    embedUrl.searchParams.set('kgPreview', '1')
    embedUrl.searchParams.set('kgLiveHero', '1')
    return embedUrl.toString()
  } catch {
    return null
  }
}
