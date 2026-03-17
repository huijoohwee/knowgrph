import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { SlideVisualMeta } from './markdownSlideVisuals'

type SlideHeaderProps = {
  meta: SlideVisualMeta
  heading: string
  page: number
  total: number
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
  uiPanelMonospaceTextClass: string
}

export function SlideHeader(props: SlideHeaderProps) {
  const { meta, heading, page, total, uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, uiPanelMonospaceTextClass } = props
  if (
    !heading &&
    !meta.authors.length &&
    !meta.meeting &&
    !meta.date &&
    !meta.venue &&
    !meta.url &&
    !meta.institution &&
    meta.themeStyle !== 'academic'
  )
    return null

  if (meta.layout === 'cover' || meta.layout === 'intro') return null

  if (meta.themeStyle === 'academic') {
    return (
      <header
        className={`absolute top-0 left-0 w-full h-10 px-8 flex justify-between items-center ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.panel.bg}/95 border-b ${UI_THEME_TOKENS.panel.border} z-20 ${uiPanelTextFontClass}`}
      >
        <div className="min-w-0 flex items-center gap-4">
          {heading ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {heading}
            </span>
          ) : meta.meeting ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {meta.meeting}
            </span>
          ) : null}
        </div>
        <div className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          <span className={`${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </div>
      </header>
    )
  }

  return (
    <header
      className={[
        'fixed top-0 left-0 w-full h-8 px-4 border-b flex justify-between items-center z-20',
        uiPanelTextFontClass,
        uiPanelMicroLabelTextSizeClass,
        UI_THEME_TOKENS.text.tertiary,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <div className="flex gap-3 min-w-0">
        {heading ? <span className="truncate">{heading}</span> : null}
        {!heading && meta.meeting ? <span className="truncate">{meta.meeting}</span> : null}
      </div>
      <div className={`${uiPanelMonospaceTextClass} opacity-60`}>
        {page} / {total}
      </div>
    </header>
  )
}

type SlideFooterProps = {
  meta: SlideVisualMeta
  page: number
  total: number
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
  uiPanelMonospaceTextClass: string
}

export function SlideFooter(props: SlideFooterProps) {
  const { meta, page, total, uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, uiPanelMonospaceTextClass } = props
  if (
    !meta.authors.length &&
    !meta.meeting &&
    !meta.date &&
    !meta.venue &&
    !meta.url &&
    !meta.institution &&
    meta.themeStyle !== 'academic'
  )
    return null

  if (meta.layout === 'cover' || meta.layout === 'intro') return null

  if (meta.themeStyle === 'academic') {
    return (
      <footer
        className={`fixed bottom-0 left-0 w-full h-8 px-4 flex justify-between items-center ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.panel.bg}/95 border-t ${UI_THEME_TOKENS.panel.border} z-10 ${uiPanelTextFontClass}`}
      >
        <div className="min-w-0 flex items-center gap-4">
          {meta.meeting && (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {meta.meeting}
            </span>
          )}
          {meta.authors.length > 0 && (
            <span className={`hidden sm:inline-block min-w-0 ${UI_THEME_TOKENS.text.secondary} truncate`}>
              {meta.authors.join(', ')}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          {(meta.institution || meta.venue) && (
            <span className={`hidden md:inline-block font-medium ${UI_THEME_TOKENS.text.primary} truncate max-w-[28rem]`}>
              {[meta.institution, meta.venue].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className={`${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={[
        'fixed bottom-0 left-0 w-full h-8 px-4 border-t flex justify-between items-center z-10',
        uiPanelTextFontClass,
        uiPanelMicroLabelTextSizeClass,
        UI_THEME_TOKENS.text.tertiary,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <div className="flex gap-3 min-w-0">
        {!!meta.meeting && <span className="truncate">{meta.meeting}</span>}
        {!!meta.venue && <span className="truncate">{meta.venue}</span>}
        {!!meta.institution && <span className="truncate">{meta.institution}</span>}
        {!!meta.date && <span className="truncate">{meta.date}</span>}
      </div>
      <div className="flex gap-3 min-w-0">
        {meta.authors.length > 0 && <span className="truncate">{meta.authors.join(', ')}</span>}
        {!!meta.url && (
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-blue-600 dark:text-blue-400 truncate"
          >
            {meta.url.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
      <div className={`${uiPanelMonospaceTextClass} opacity-60 shrink-0`}>
        {page} / {total}
      </div>
    </footer>
  )
}
