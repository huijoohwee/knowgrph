import React from 'react'
import type { RichMediaPreviewDescriptor } from 'grph-shared/rich-media/providers'
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
  const tooltipId = React.useId()
  const touchTapArmedRef = React.useRef(false)
  const pointerTypeRef = React.useRef<string | null>(null)
  const embedUrl = preview?.kind === 'timestamp-embed' ? String(preview.embedUrl || '') : ''
  const timestampLabel = String(preview?.timestampLabel || '')

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

  const openPreview = () => {
    setOpen(true)
  }

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
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          data-kg-youtube-timestamp-preview="1"
          data-kg-rich-media-preview-key={preview.semanticKey}
          data-src={embedUrl}
          data-kg-canvas-pointer-ignore="true"
          data-kg-canvas-wheel-ignore="true"
          className={[
            'pointer-events-none absolute left-1/2 top-full z-[70] mt-2 w-56 max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded border shadow-xl',
            UI_THEME_TOKENS.panel.bg,
            UI_THEME_TOKENS.panel.border,
          ].join(' ')}
        >
          <iframe
            src={embedUrl}
            title={`YouTube preview at ${timestampLabel}`}
            loading="lazy"
            allow="fullscreen; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="block aspect-video w-full bg-black"
          />
          <span className={`block px-2 py-1 text-[11px] leading-tight ${UI_THEME_TOKENS.text.secondary}`}>
            {timestampLabel}
          </span>
        </span>
      ) : null}
    </span>
  )
}
