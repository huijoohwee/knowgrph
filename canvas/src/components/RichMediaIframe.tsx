import React from 'react'
import { buildIframeSrcDocForUrl } from '@/lib/render/richMediaEmbed'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'

export type RichMediaIframeMode = 'proxy-url' | 'srcdoc-when-needed'

export type RichMediaIframeProps = {
  url: string
  title: string
  mode?: RichMediaIframeMode
  className?: string
  style?: React.CSSProperties
  onLoad?: React.ReactEventHandler<HTMLIFrameElement>
}

export default function RichMediaIframe(props: RichMediaIframeProps) {
  const mode: RichMediaIframeMode = props.mode === 'proxy-url' ? 'proxy-url' : 'srcdoc-when-needed'
  const rawUrl = String(props.url || '').trim()
  const embed = React.useMemo(() => resolveIframeEmbed({ url: rawUrl }), [rawUrl])
  const direct = embed.direct
  const src = embed.iframeSrc
  const sandbox = embed.sandbox
  const [srcDoc, setSrcDoc] = React.useState<string>('')

  React.useEffect(() => {
    if (mode !== 'srcdoc-when-needed' || direct || !rawUrl || !/^https?:\/\//i.test(rawUrl)) {
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
  }, [direct, mode, rawUrl])

  return (
    <iframe
      src={src}
      srcDoc={srcDoc || undefined}
      title={props.title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      sandbox={sandbox}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={props.className}
      style={props.style}
      onLoad={props.onLoad}
    />
  )
}
