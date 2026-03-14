import React from 'react'

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
      <iframe
        className="flex-1 min-h-0 w-full border border-[var(--kg-border)] bg-white"
        ref={props.onIframeRef}
        title={props.url || 'Webpage'}
        src={props.iframeSrc || undefined}
        srcDoc={props.iframeSrcDoc || undefined}
        sandbox="allow-scripts"
        loading="lazy"
        allow="geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
        referrerPolicy="no-referrer"
      />
    </section>
  )
}

