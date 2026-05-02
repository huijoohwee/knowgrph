import React from 'react'
import { buildIframeSrcDocForUrl } from '@/lib/render/richMediaEmbed'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'
import { useGraphStore } from '@/hooks/useGraphStore'

export type RichMediaIframeProps = {
  url: string
  title: string
  className?: string
  style?: React.CSSProperties
  onLoad?: React.ReactEventHandler<HTMLIFrameElement>
}

export default function RichMediaIframe(props: RichMediaIframeProps) {
  const rawUrl = String(props.url || '').trim()
  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)
  const preferEmbed = richMediaPanelMode === 'embed'
  const [forceProxy, setForceProxy] = React.useState(false)
  const embed = React.useMemo(
    () => resolveIframeEmbed({
      url: rawUrl,
      embedMode: forceProxy ? 'proxy' : undefined,
      scriptPolicy: (preferEmbed || forceProxy) ? 'allow' : undefined,
    }),
    [forceProxy, preferEmbed, rawUrl],
  )
  const direct = embed.direct
  const src = embed.iframeSrc
  const sandbox = embed.sandbox
  const [srcDoc, setSrcDoc] = React.useState<string>('')

  React.useEffect(() => {
    if (preferEmbed || direct || !rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      setSrcDoc(prev => (prev ? '' : prev))
      return
    }
    const ctrl = new AbortController()
    void buildIframeSrcDocForUrl({ url: rawUrl, signal: ctrl.signal })
      .then(({ srcDoc }) => {
        if (ctrl.signal.aborted) return
        if (!srcDoc) return
        setSrcDoc(prev => (prev === srcDoc ? prev : srcDoc))
      })
      .catch(() => void 0)
    return () => {
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [direct, preferEmbed, rawUrl])

  return (
    <iframe
      src={src}
      srcDoc={srcDoc || undefined}
      title={props.title}
      allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      sandbox={sandbox}
      referrerPolicy={direct ? 'strict-origin-when-cross-origin' : 'no-referrer'}
      loading="lazy"
      className={props.className}
      style={props.style}
      onError={() => {
        if (!forceProxy && /^https?:\/\//i.test(rawUrl)) {
          setForceProxy(true)
          return
        }
      }}
      onLoad={props.onLoad}
    />
  )
}
