import React from 'react'
import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'
import { resolveIframeSandbox } from 'grph-shared/rich-media/iframe'
import { resolveMediaPreviewSelectableDataAttr } from '@/lib/cards/mediaPreviewSurfaceSelection'

export type SharedWebpageSurfaceFrameProps = {
  title: string
  className?: string
  style?: React.CSSProperties
  onLoad?: React.ReactEventHandler<HTMLIFrameElement>
}

export type SharedWebpageSurfaceProps = {
  renderMode: 'snapshot' | 'iframe'
  webpageUrl: string
  title: string
  className?: string
  style?: React.CSSProperties
  iframeSrc?: string | null
  iframeSrcDoc?: string | null
  iframeAllow?: string
  iframeSandbox?: string
  iframeLoading?: 'eager' | 'lazy'
  iframeAllowFullScreen?: boolean
  iframeReferrerPolicy?: React.HTMLAttributeReferrerPolicy
  iframeRef?: React.Ref<HTMLIFrameElement>
  iframeScrolling?: 'auto' | 'yes' | 'no'
  iframeSelectableSurfaceDataAttr?: boolean
  onLoad?: React.ReactEventHandler<HTMLIFrameElement>
  iframeRenderer?: (props: SharedWebpageSurfaceFrameProps) => React.ReactNode
}

const DEFAULT_IFRAME_ALLOW =
  "fullscreen; geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"

export function SharedWebpageSurface(props: SharedWebpageSurfaceProps) {
  const webpageUrl = String(props.webpageUrl || '').trim()
  const title = String(props.title || '').trim() || 'Webpage'

  if (props.renderMode === 'snapshot') {
    return (
      <WebpageSnapshotPreview
        url={webpageUrl}
        title={title}
        className={props.className}
        style={props.style}
      />
    )
  }

  const frameProps: SharedWebpageSurfaceFrameProps = {
    title,
    className: props.className,
    style: props.style,
    onLoad: props.onLoad,
  }
  if (typeof props.iframeRenderer === 'function') {
    return <>{props.iframeRenderer(frameProps)}</>
  }

  return (
    <iframe
      className={props.className}
      title={title}
      src={props.iframeSrc || undefined}
      srcDoc={props.iframeSrcDoc || undefined}
      sandbox={props.iframeSandbox || resolveIframeSandbox('proxied')}
      loading={props.iframeLoading || 'lazy'}
      allow={props.iframeAllow || DEFAULT_IFRAME_ALLOW}
      allowFullScreen={props.iframeAllowFullScreen === true}
      referrerPolicy={props.iframeReferrerPolicy || 'no-referrer'}
      ref={props.iframeRef}
      scrolling={props.iframeScrolling}
      data-kg-rich-media-selectable-surface={resolveMediaPreviewSelectableDataAttr(props.iframeSelectableSurfaceDataAttr === true)}
      style={props.style}
      onLoad={props.onLoad}
    />
  )
}
