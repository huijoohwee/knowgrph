import React from 'react'
import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'
import { useGraphStore } from '@/hooks/useGraphStore'

type MarkdownWorkspaceWebpageSurfaceProps = {
  ariaLabel: string
  webpageUrl: string
  iframeSrc: string | null
  iframeSrcDoc: string | null
}

export function MarkdownWorkspaceWebpageSurface(props: MarkdownWorkspaceWebpageSurfaceProps) {
  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)
  const preferEmbed = richMediaPanelMode === 'embed'
  const webpageUrl = String(props.webpageUrl || '').trim()
  const hasHttpUrl = /^https?:\/\//i.test(webpageUrl)

  return (
    <section className="flex-1 min-h-0 flex" aria-label={props.ariaLabel}>
      <SharedWebpageSurface
        renderMode={!preferEmbed && hasHttpUrl ? 'snapshot' : 'iframe'}
        webpageUrl={webpageUrl}
        title={webpageUrl || 'Webpage'}
        className="flex-1 min-h-0 w-full border-0"
        iframeSrc={props.iframeSrc}
        iframeSrcDoc={props.iframeSrcDoc}
        iframeAllowFullScreen
      />
    </section>
  )
}
