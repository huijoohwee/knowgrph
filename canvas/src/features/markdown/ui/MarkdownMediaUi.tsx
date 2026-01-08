import React from 'react'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildMarkdownPreviewMediaKey } from '@/features/markdown/ui/markdownPreviewLinks'
import type { RenderOpts } from './MarkdownRendererTypes'

type MediaWrapperProps = {
  type: string
  srcRaw: string
  startLine: number
  highlightClass: string
  opts: RenderOpts
  children: React.ReactNode
  className?: string
}

export const MediaWrapper = ({
  type,
  srcRaw,
  startLine,
  highlightClass,
  opts,
  children,
  className,
}: MediaWrapperProps) => {
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)

  const handleClick = () => {
    if (opts.previewOverlayScope === 'container') return
    try {
      const key = buildMarkdownPreviewMediaKey(type, startLine, srcRaw)
      setMarkdownPreviewActiveMediaKey(key)
    } catch {
      void 0
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
        )
      }
    } catch {
      void 0
    }
  }

  return (
    <div
      className={['mt-4 mb-4', highlightClass, className].filter(Boolean).join(' ')}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

export const MediaIframe = ({
  src,
  title,
  presentationMode,
}: {
  src: string
  title: string
  presentationMode: boolean
}) => {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    return <MediaErrorPlaceholder alt={title} />
  }
  return (
    <div className={presentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        className="w-full h-full rounded border border-gray-200"
        onError={() => setError(true)}
      />
    </div>
  )
}

export const MediaVideo = ({ src }: { src: string }) => {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    return <MediaErrorPlaceholder alt="Video" />
  }
  return (
    <video
      controls
      className="w-full max-w-2xl rounded border border-gray-200"
      src={src}
      onError={() => setError(true)}
    />
  )
}

const MediaErrorPlaceholder = ({ alt }: { alt?: string }) => (
  <div className="flex items-center justify-center w-full max-w-xl h-32 rounded border border-dashed border-red-300 bg-red-50 text-[11px] text-red-700 px-3 text-center">
    <span>{alt ? `Media failed to load: ${alt}` : 'Media failed to load'}</span>
  </div>
)

export const MediaImage = ({
  src,
  alt,
  width,
  height,
}: {
  src?: string
  alt: string
  width?: number | null
  height?: number | null
}) => {
  const [error, setError] = React.useState(false)
  const style: React.CSSProperties = {}
  if (width) {
    style.width = `${Math.round(width)}px`
    style.maxWidth = '100%'
  }
  if (height) style.height = `${Math.round(height)}px`
  if (!src || error) {
    return <MediaErrorPlaceholder alt={alt} />
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      style={Object.keys(style).length ? style : undefined}
      className="max-w-full h-auto rounded border border-gray-200"
      onError={() => setError(true)}
    />
  )
}
