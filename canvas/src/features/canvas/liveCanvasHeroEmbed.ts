import { resolveLiveCanvasHeroEnterHref } from '@/lib/routing/basePath'
import {
  QUERY_PARAM_IMPORT_CANVAS_EMBED,
  QUERY_PARAM_OPEN_EDITOR_WORKSPACE,
} from '@/lib/routing/queryParams'

export function resolveLiveCanvasHeroImportEmbedHref(baseUrl?: string | null): string {
  const path = resolveLiveCanvasHeroEnterHref(baseUrl)
  const params = new URLSearchParams({
    [QUERY_PARAM_OPEN_EDITOR_WORKSPACE]: '1',
    [QUERY_PARAM_IMPORT_CANVAS_EMBED]: '1',
  })
  return `${path}?${params.toString()}`
}

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
