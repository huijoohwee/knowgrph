import React from 'react'
import { buildIframeSrcDocForUrl, buildWebpageProxyUrl, isIframeDirectEmbedUrl } from '@/lib/render/richMediaEmbed'

export type RichMediaIframeMode = 'proxy-url' | 'srcdoc-when-needed'

export type RichMediaIframeProps = {
  url: string
  title: string
  mode?: RichMediaIframeMode
  className?: string
  style?: React.CSSProperties
}

export default function RichMediaIframe(props: RichMediaIframeProps) {
  const mode: RichMediaIframeMode = props.mode === 'proxy-url' ? 'proxy-url' : 'srcdoc-when-needed'
  const rawUrl = String(props.url || '').trim()
  const direct = isIframeDirectEmbedUrl(rawUrl)
  const src = direct ? rawUrl : buildWebpageProxyUrl(rawUrl)
  const sandbox = direct
    ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'
    : 'allow-scripts allow-presentation'
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
    />
  )
}
