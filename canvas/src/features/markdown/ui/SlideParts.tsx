import React from 'react'
import { UI_RESPONSIVE_MARKDOWN_PRESENTATION_META_TEXT_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
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
  positionMode?: 'viewport-fixed' | 'slide-absolute' | 'slide-flow'
}

export function SlideHeader(props: SlideHeaderProps) {
  const {
    meta,
    heading,
    page,
    total,
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelMonospaceTextClass,
    positionMode = 'viewport-fixed',
  } = props
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

  const absoluteHeaderClass = 'absolute top-0 left-0 w-full'
  const fixedHeaderClass = 'fixed top-0 left-0 w-full'
  const flowHeaderClass = 'relative w-full shrink-0'
  const headerPositionClass =
    positionMode === 'slide-absolute'
      ? absoluteHeaderClass
      : positionMode === 'slide-flow'
        ? flowHeaderClass
        : meta.themeStyle === 'academic'
          ? absoluteHeaderClass
          : fixedHeaderClass
  const absoluteClampClass = positionMode === 'slide-absolute' ? 'overflow-hidden whitespace-nowrap' : ''

  if (meta.themeStyle === 'academic') {
    return (
      <header
        className={`${headerPositionClass} h-10 px-8 flex justify-between items-center ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.panel.bg}/95 border-b ${UI_THEME_TOKENS.panel.border} z-20 ${uiPanelTextFontClass}`}
      >
        <section className={`min-w-0 flex items-center gap-4 ${absoluteClampClass}`}>
          {heading ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {heading}
            </span>
          ) : meta.meeting ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {meta.meeting}
            </span>
          ) : null}
        </section>
        <section className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          <span className={`${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </section>
      </header>
    )
  }

  return (
    <header
      className={[
        headerPositionClass,
        `h-8 px-4 border-b flex justify-between items-center z-20 ${absoluteClampClass}`,
        uiPanelTextFontClass,
        uiPanelMicroLabelTextSizeClass,
        UI_THEME_TOKENS.text.tertiary,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <section className="flex gap-3 min-w-0">
        {heading ? <span className="truncate">{heading}</span> : null}
        {!heading && meta.meeting ? <span className="truncate">{meta.meeting}</span> : null}
      </section>
      <section className={`${uiPanelMonospaceTextClass} opacity-60`}>
        {page} / {total}
      </section>
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
  positionMode?: 'viewport-fixed' | 'slide-absolute' | 'slide-flow'
}

export function SlideFooter(props: SlideFooterProps) {
  const {
    meta,
    page,
    total,
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelMonospaceTextClass,
    positionMode = 'viewport-fixed',
  } = props
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

  const absoluteFooterClass = 'absolute bottom-0 left-0 w-full'
  const fixedFooterClass = 'fixed bottom-0 left-0 w-full'
  const flowFooterClass = 'relative w-full shrink-0'
  const footerPositionClass =
    positionMode === 'slide-absolute' ? absoluteFooterClass : positionMode === 'slide-flow' ? flowFooterClass : fixedFooterClass
  const absoluteFooterClampClass = positionMode === 'slide-absolute' ? 'overflow-hidden whitespace-nowrap' : ''

  if (meta.themeStyle === 'academic') {
    return (
      <footer
        className={`${footerPositionClass} h-10 px-4 flex justify-between items-center ${absoluteFooterClampClass} ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.panel.bg}/95 border-t ${UI_THEME_TOKENS.panel.border} z-10 ${uiPanelTextFontClass}`}
      >
        <section className={`min-w-0 flex items-center gap-4 ${absoluteFooterClampClass}`}>
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
        </section>
        <section className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          {(meta.institution || meta.venue) && (
            <span className={`hidden md:inline-block font-medium ${UI_THEME_TOKENS.text.primary} ${UI_RESPONSIVE_MARKDOWN_PRESENTATION_META_TEXT_CLASSNAME}`}>
              {[meta.institution, meta.venue].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className={`${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </section>
      </footer>
    )
  }

  return (
    <footer
      className={[
        footerPositionClass,
        `h-8 px-4 border-t flex justify-between items-center z-10 ${absoluteFooterClampClass}`,
        uiPanelTextFontClass,
        uiPanelMicroLabelTextSizeClass,
        UI_THEME_TOKENS.text.tertiary,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <section className="flex gap-3 min-w-0">
        {!!meta.meeting && <span className="truncate">{meta.meeting}</span>}
        {!!meta.venue && <span className="truncate">{meta.venue}</span>}
        {!!meta.institution && <span className="truncate">{meta.institution}</span>}
        {!!meta.date && <span className="truncate">{meta.date}</span>}
      </section>
      <section className="flex gap-3 min-w-0">
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
      </section>
      <section className={`${uiPanelMonospaceTextClass} opacity-60 shrink-0`}>
        {page} / {total}
      </section>
    </footer>
  )
}
