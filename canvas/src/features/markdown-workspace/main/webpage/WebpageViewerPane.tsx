import React from 'react'
import { resolveIframeSandbox } from 'grph-shared/rich-media/iframe'
import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function WebpageViewerPane(props: {
  url: string
  iframeSrc: string | null
  iframeSrcDoc: string | null
  onIframeRef: (el: HTMLIFrameElement | null) => void
  onViewerRef: (el: HTMLElement | null) => void
}) {
  return (
    <section
      ref={el => {
        props.onViewerRef(el)
      }}
      className="flex-1 min-h-0 flex"
      aria-label="Webpage Viewer"
    >
      <SharedWebpageSurface
        renderMode="iframe"
        webpageUrl={props.url}
        title={props.url || 'Webpage'}
        className={`flex-1 min-h-0 w-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
        iframeSrc={props.iframeSrc}
        iframeSrcDoc={props.iframeSrcDoc}
        iframeSandbox={resolveIframeSandbox('proxied')}
        iframeLoading="eager"
        iframeAllowFullScreen
        iframeRenderer={frameProps => (
          <iframe
            {...frameProps}
            ref={props.onIframeRef}
            src={props.iframeSrc || undefined}
            srcDoc={props.iframeSrcDoc || undefined}
            sandbox={resolveIframeSandbox('proxied')}
            loading="eager"
            allow="fullscreen; geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}
      />
    </section>
  )
}
