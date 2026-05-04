import React from 'react'
import type { WebpageFrontmatterMeta, WebsiteImportFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { useWebpageIframeSrcdoc } from '../useWebpageIframeSrcdoc'

export function useWebpageIframeView(args: {
  enabled: boolean
  webpageMeta: WebpageFrontmatterMeta | null
  websiteImportMeta: WebsiteImportFrontmatterMeta | null
  webpageHtmlOverride?: string | null
  onStatusProgress?: (label: string, current?: number | null, total?: number | null, bytesCurrent?: number | null, bytesTotal?: number | null) => void
  onStatusWithAutoClear?: (label: string, ttlMs?: number) => void
}): { iframeSrcDoc: string | null; iframeSrc: string | null } {
  const enabled = args.enabled
  const url = String(args.webpageMeta?.url || '')
  const view = args.webpageMeta?.view === 'json' ? 'json' : 'html'
  const htmlOverride = args.webpageMeta?.view === 'html' ? args.webpageHtmlOverride ?? null : null

  const { srcDoc, src } = useWebpageIframeSrcdoc({
    enabled,
    url,
    view,
    websiteImportMeta: args.websiteImportMeta && args.websiteImportMeta.importId && args.websiteImportMeta.nodeId ? args.websiteImportMeta : null,
    includeImages: args.webpageMeta?.includeImages,
    htmlOverride,
    siteRootRel: args.webpageMeta?.siteRootRel || null,
    onStatusProgress: args.onStatusProgress,
    onStatusWithAutoClear: args.onStatusWithAutoClear,
  })

  const stableSrc = args.webpageMeta?.view === 'json' ? null : src
  return React.useMemo(() => ({ iframeSrcDoc: srcDoc, iframeSrc: stableSrc }), [srcDoc, stableSrc])
}
