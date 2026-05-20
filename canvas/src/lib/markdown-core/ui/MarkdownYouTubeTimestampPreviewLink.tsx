import React from 'react'
import { createPortal } from 'react-dom'
import type { RichMediaPreviewDescriptor } from 'grph-shared/rich-media/providers'
import RichMediaPanel from '@/components/RichMediaPanel'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildAnchorAttrs } from './markdownPreviewLinks.impl'

const isCoarsePointerViewport = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(hover: none), (pointer: coarse)').matches) return true
  } catch {
    void 0
  }
  const maxTouchPoints = Number(window.navigator?.maxTouchPoints || 0)
  return Number.isFinite(maxTouchPoints) && maxTouchPoints > 0
}

export function YouTubeTimestampPreviewLink({
  href,
  anchor,
  preview,
  children,
}: {
  href: string
  anchor: ReturnType<typeof buildAnchorAttrs>
  preview: RichMediaPreviewDescriptor | null
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [previewPosition, setPreviewPosition] = React.useState<{ left: number; top: number } | null>(null)
  const tooltipId = React.useId()
  const linkRef = React.useRef<HTMLAnchorElement | null>(null)
  const touchTapArmedRef = React.useRef(false)
  const pointerTypeRef = React.useRef<string | null>(null)
  const embedUrl = preview?.kind === 'timestamp-embed' ? String(preview.embedUrl || '') : ''
  const timestampLabel = String(preview?.timestampLabel || '')
  const panelState = React.useMemo(
    () => buildStaticRichMediaPanelOverlayState({ renderKind: 'iframe' }),
    [],
  )
  const panelStyle = React.useMemo<React.CSSProperties>(() => ({
    width: '100%',
    height: '100%',
    boxShadow: 'none',
    ['--kg-media-panel-padding' as never]: '0px',
    ['--kg-media-panel-radius' as never]: '6px',
  }), [])

  if (!embedUrl || !timestampLabel) {
    return (
      <a href={href} target={anchor.target} rel={anchor.rel} className={anchor.className}>
        {children}
      </a>
    )
  }

  const close = () => {
    touchTapArmedRef.current = false
    pointerTypeRef.current = null
    setOpen(false)
  }

  const updatePreviewPosition = React.useCallback(() => {
    const el = linkRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const previewWidth = Math.min(224, Math.max(160, window.innerWidth - 32))
    const halfWidth = previewWidth / 2
    setPreviewPosition({
      left: Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, rect.left + (rect.width / 2))),
      top: rect.bottom + 8,
    })
  }, [])

  const openPreview = () => {
    updatePreviewPosition()
    setOpen(true)
  }

  React.useEffect(() => {
    if (!open) return
    updatePreviewPosition()
    const handleViewportChange = () => updatePreviewPosition()
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open, updatePreviewPosition])

  const handlePointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
    pointerTypeRef.current = event.pointerType || null
  }

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const pointerType = pointerTypeRef.current
    const isKeyboardActivation = event.detail === 0
    const wantsTapPreview = !isKeyboardActivation && (pointerType === 'touch' || pointerType === 'pen' || isCoarsePointerViewport())
    if (!wantsTapPreview || touchTapArmedRef.current) return
    touchTapArmedRef.current = true
    event.preventDefault()
    event.stopPropagation()
    openPreview()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    close()
  }

  return (
    <span className="relative inline-flex items-baseline overflow-visible align-baseline">
      <a
        ref={linkRef}
        href={href}
        target={anchor.target}
        rel={anchor.rel}
        className={anchor.className}
        aria-describedby={open ? tooltipId : undefined}
        data-kg-youtube-timestamp-link="1"
        data-kg-rich-media-preview-key={preview.semanticKey}
        data-kg-youtube-timestamp={timestampLabel}
        onMouseEnter={openPreview}
        onMouseLeave={close}
        onFocus={openPreview}
        onBlur={close}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </a>
      {open && previewPosition && typeof document !== 'undefined' ? createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          data-kg-youtube-timestamp-preview="1"
          data-kg-rich-media-preview-key={preview.semanticKey}
          data-src={embedUrl}
          data-kg-canvas-pointer-ignore="true"
          data-kg-canvas-wheel-ignore="true"
          className={['pointer-events-none fixed z-[70] w-56 max-w-[min(14rem,calc(100vw-2rem))] overflow-hidden rounded border shadow-xl', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.panel.border].join(' ')}
          style={{
            left: previewPosition.left,
            top: previewPosition.top,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="block aspect-video w-full bg-black">
            <RichMediaPanel
              title={`YouTube preview at ${timestampLabel}`}
              url={embedUrl}
              openUrl={href}
              kind="iframe"
              interactive={false}
              panel={panelState}
              style={panelStyle}
            />
          </span>
          <span className={`block px-2 py-1 text-[11px] leading-tight ${UI_THEME_TOKENS.text.secondary}`}>
            {timestampLabel}
          </span>
        </span>,
        document.body,
      ) : null}
    </span>
  )
}
