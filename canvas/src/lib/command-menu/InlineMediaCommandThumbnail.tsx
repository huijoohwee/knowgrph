import React from 'react'
import { FileAudio, Image, Video } from 'lucide-react'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const INLINE_MEDIA_COMMAND_THUMBNAIL_ATTR = 'data-kg-inline-command-thumbnail'

export function InlineMediaCommandThumbnail(props: {
  kind?: InlineMediaKind
  thumbnailUrl?: string
  thumbnailAlt?: string
  variant?: 'menu' | 'inline'
}) {
  const kind = props.kind || 'image'
  const isInline = props.variant === 'inline'
  const baseClassName = isInline
    ? `m-0 h-3 w-3 shrink-0 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.input.bg}`
    : `m-0 h-8 w-14 shrink-0 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.input.bg} shadow-sm`
  const iconClassName = isInline ? 'h-2 w-2' : 'h-4 w-4'
  if (props.thumbnailUrl) {
    const body = (
      <>
        <img
          src={props.thumbnailUrl}
          alt={props.thumbnailAlt || ''}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {kind === 'video' ? (
          <span className="absolute inset-0 grid place-items-center bg-black/15 text-white">
            <Video className={`${iconClassName} drop-shadow`} strokeWidth={1.8} />
          </span>
        ) : null}
      </>
    )
    return isInline ? (
      <span
        className={`relative flex overflow-hidden ${baseClassName} p-[2px]`}
        aria-hidden="true"
        data-kg-inline-command-thumbnail={kind}
      >
        {body}
      </span>
    ) : (
      <figure
        className={`relative flex overflow-hidden ${baseClassName} p-[2px]`}
        aria-hidden="true"
        data-kg-inline-command-thumbnail={kind}
      >
        {body}
      </figure>
    )
  }
  const icon = kind === 'video'
    ? <Video className={iconClassName} strokeWidth={1.8} />
    : kind === 'audio'
      ? <FileAudio className={iconClassName} strokeWidth={1.8} />
      : <Image className={iconClassName} strokeWidth={1.8} />
  return isInline ? (
    <span
      className={`grid place-items-center ${baseClassName} ${UI_THEME_TOKENS.text.tertiary}`}
      aria-hidden="true"
      data-kg-inline-command-thumbnail={kind}
    >
      {icon}
    </span>
  ) : (
    <figure
      className={`grid place-items-center ${baseClassName} ${UI_THEME_TOKENS.text.tertiary}`}
      aria-hidden="true"
      data-kg-inline-command-thumbnail={kind}
    >
      {icon}
    </figure>
  )
}
