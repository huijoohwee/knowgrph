import React from 'react'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { TokenWithLines } from './markdownPreviewLex'

type PresentationNotesProps = {
  notesTokens: TokenWithLines[] | null
  activeDocumentPath: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope?: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  className?: string
}

export function PresentationNotes(props: PresentationNotesProps) {
  const {
    notesTokens,
    className,
    previewOverlayScope,
    previewOverlayPortalTarget,
    ...rest
  } = props
  if (!notesTokens || notesTokens.length === 0) return null
  
  return (
    <aside className={className} aria-label="Speaker Notes">
        <div className={['px-4 py-3 text-xs text-gray-800', props.uiPanelTextFontClass].filter(Boolean).join(' ')}>
            <MarkdownTokenRenderer
                tokens={notesTokens}
                highlightedLineRange={null}
                markdownWordWrap={true}
                markdownPresentationMode={false}
                markdownTextHighlight={false}
                selectionKind={null}
                previewOverlayScope={previewOverlayScope ?? 'viewport'}
                previewOverlayPortalTarget={previewOverlayPortalTarget ?? null}
                {...rest}
            />
        </div>
    </aside>
  )
}
