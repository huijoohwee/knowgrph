import React from 'react'
import { ExternalLink, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const MEDIA_TRANSLUCENT_OVERLAY_CLASSNAME = [
  'absolute z-10 inline-flex h-5 w-5 items-center justify-center rounded border shadow-sm backdrop-blur-sm',
  UI_THEME_TOKENS.panel.border,
  'bg-[color:var(--kg-panel-bg)]/80',
  UI_THEME_TOKENS.text.secondary,
].join(' ')

export function MediaKindOverlay({
  Icon,
  label,
  className,
}: {
  Icon: LucideIcon
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        MEDIA_TRANSLUCENT_OVERLAY_CLASSNAME,
        'pointer-events-none left-1 top-1',
        className,
      )}
      title={label}
      aria-label={label}
      data-kg-media-kind-overlay-icon={label}
    >
      <Icon className="h-3 w-3" strokeWidth={1.7} aria-hidden />
    </span>
  )
}

export function MediaOpenLinkOverlay({
  href,
  label = 'Open media link',
  className,
}: {
  href: string
  label?: string
  className?: string
}) {
  const normalizedHref = String(href || '').trim()
  if (!normalizedHref) return null
  return (
    <a
      href={normalizedHref}
      target="_blank"
      rel="noreferrer"
      className={cn(
        MEDIA_TRANSLUCENT_OVERLAY_CLASSNAME,
        'pointer-events-auto bottom-1 right-1',
        className,
      )}
      title={label}
      aria-label={label}
      data-kg-media-open-link-overlay="1"
      data-kg-media-row-control="1"
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <ExternalLink className="h-3 w-3" strokeWidth={1.7} aria-hidden />
    </a>
  )
}

export function MediaInfoOverlay({
  label = 'Media info',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        MEDIA_TRANSLUCENT_OVERLAY_CLASSNAME,
        'group pointer-events-auto bottom-1 left-1',
        className,
      )}
      title={label}
      aria-label={label}
      data-kg-media-info-overlay="1"
      tabIndex={0}
    >
      <Info className="h-3 w-3" strokeWidth={1.7} aria-hidden />
      <span
        className={cn(
          'pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-max max-w-[16rem] rounded border px-2 py-1 text-left text-[10px] leading-4 shadow-lg backdrop-blur-sm group-hover:block group-focus:block',
          UI_THEME_TOKENS.panel.border,
          'bg-[color:var(--kg-panel-bg)]/95',
          UI_THEME_TOKENS.text.secondary,
        )}
        data-kg-media-info-overlay-tooltip="1"
      >
        {label}
      </span>
    </span>
  )
}
