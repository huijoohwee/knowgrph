import React from 'react'
import { resolveIframeSandbox } from 'grph-shared/rich-media/iframe'
import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'
import { useGraphStore } from '@/hooks/useGraphStore'

export function WebpageViewerPane(props: {
  url: string
  iframeSrc: string | null
  iframeSrcDoc: string | null
  onIframeRef: (el: HTMLIFrameElement | null) => void
  onViewerRef: (el: HTMLElement | null) => void
}) {
  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)
  const preferEmbed = richMediaPanelMode === 'embed'
  const hasHttpUrl = /^https?:\/\//i.test(String(props.url || '').trim())

  return (
    <section
      ref={el => {
        props.onViewerRef(el)
      }}
      className="flex-1 min-h-0 flex"
      aria-label="Webpage Viewer"
    >
      {!preferEmbed && hasHttpUrl ? (
        <WebpageSnapshotPreview
          url={props.url}
          title={props.url || 'Webpage'}
          className="flex-1 min-h-0 w-full"
          style={{ border: `1px solid var(--kg-border)` }}
        />
      ) : (
        <iframe
          className="flex-1 min-h-0 w-full border border-[var(--kg-border)] bg-white"
          ref={props.onIframeRef}
          title={props.url || 'Webpage'}
          src={props.iframeSrc || undefined}
          srcDoc={props.iframeSrcDoc || undefined}
          sandbox={resolveIframeSandbox('proxied')}
          loading="lazy"
          allow="fullscreen; geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      )}
    </section>
  )
}
