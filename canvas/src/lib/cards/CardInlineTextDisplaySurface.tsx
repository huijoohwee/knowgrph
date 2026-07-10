import React from 'react'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME } from '@/features/markdown/ui/dataViewChipStyles'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { normalizeCardInlineMediaSoftLineBreaks } from '@/lib/cards/cardMarkdownPreviewUtils'
import { shouldOpenMarkdownViewerInlineEditorFromReadClick } from '@/lib/markdown-core/ui/markdownInlineEditActivation'
import { readInlineCommandMenuSigilFromKeyEvent } from '@/lib/command-menu/inlineCommandMenuTrigger'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { CardInlineTextChipDensity, CardInlineTextEditActivation } from '@/lib/cards/CardInlineTextEditorSupport'

type CardInlineTextDisplaySurfaceProps = {
  activateExternalCommandTarget: () => void
  ariaLabel: string
  canEdit: boolean
  densityOwnedDisplayClassName: string
  displayLineClassName: string
  displayRef: React.RefObject<HTMLElement | null>
  displaySourceValue: string
  displayText: string
  displayTitle: string
  editActivation: CardInlineTextEditActivation
  emptyClassName?: string
  enableMarkdownCommandMenus: boolean
  id?: string
  inlineChipDensity: CardInlineTextChipDensity
  markdownDocumentPath: string
  onOpenEditorFromDisplayEvent: (event: React.MouseEvent<HTMLElement>, options?: { useMarkdownViewerActivation?: boolean }) => boolean
  openDisplayCommandMenuForSigil: (sigil: '/' | '@' | '#') => boolean
  openOnPointerDown: boolean
  placeholder: string
  renderInlineMediaCandidateChip: (args: { value: string; label: string; className: string }) => React.ReactNode
  showMarkdownPreview: boolean
  showPlaceholder: boolean
  shouldIgnoreInlineEditTarget: (target: EventTarget | null) => boolean
  stopActivationPropagation: boolean
}

export function CardInlineTextDisplaySurface(props: CardInlineTextDisplaySurfaceProps) {
  const displaySourceValue = props.inlineChipDensity === 'compact'
    ? normalizeCardInlineMediaSoftLineBreaks(props.displaySourceValue).trim()
    : props.displaySourceValue
  const openFromPointer = (event: React.MouseEvent<HTMLElement>) => {
    const useMarkdownViewerActivation = props.showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
    if (!useMarkdownViewerActivation && props.shouldIgnoreInlineEditTarget(event.target)) return
    if (props.editActivation !== 'click' && !useMarkdownViewerActivation && event.detail < 2) return
    if (props.openOnPointerDown && props.editActivation === 'click') props.onOpenEditorFromDisplayEvent(event)
    else if (props.stopActivationPropagation) event.stopPropagation()
  }
  return (
    <section
      ref={props.displayRef}
      id={props.id}
      className={[props.densityOwnedDisplayClassName, props.displayLineClassName, props.canEdit ? 'cursor-text' : '', props.showPlaceholder ? props.emptyClassName || `${UI_THEME_TOKENS.text.tertiary} italic` : ''].join(' ').trim()}
      title={props.displayTitle}
      aria-label={props.ariaLabel}
      data-kg-card-inline-edit="1"
      data-kg-card-inline-edit-activation={props.editActivation}
      data-kg-card-inline-chip-density={props.inlineChipDensity === 'compact' ? 'compact' : undefined}
      data-kg-card-inline-command-display={props.enableMarkdownCommandMenus ? '1' : undefined}
      tabIndex={props.canEdit && props.enableMarkdownCommandMenus ? 0 : undefined}
      onKeyDown={event => {
        if (!props.canEdit) return
        const sigil = props.enableMarkdownCommandMenus ? readInlineCommandMenuSigilFromKeyEvent(event.nativeEvent) : null
        if (!sigil) return
        event.preventDefault()
        if (props.stopActivationPropagation) event.stopPropagation()
        props.activateExternalCommandTarget()
        props.openDisplayCommandMenuForSigil(sigil)
      }}
      onDoubleClick={event => { if (props.editActivation === 'doubleClick') props.onOpenEditorFromDisplayEvent(event) }}
      onPointerDown={event => { if (props.canEdit) { props.activateExternalCommandTarget(); openFromPointer(event) } }}
      onPointerUp={() => { if (props.canEdit) props.activateExternalCommandTarget() }}
      onMouseDown={event => { if (props.canEdit) { props.activateExternalCommandTarget(); openFromPointer(event) } }}
      onMouseUp={() => { if (props.canEdit) props.activateExternalCommandTarget() }}
      onClick={event => {
        if (!props.canEdit) return
        props.activateExternalCommandTarget()
        const useMarkdownViewerActivation = props.showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (props.editActivation !== 'click' && !useMarkdownViewerActivation) return
        props.onOpenEditorFromDisplayEvent(event, { useMarkdownViewerActivation })
      }}
      onDragStart={event => { event.preventDefault(); event.stopPropagation() }}
    >
      {props.showPlaceholder ? props.placeholder : props.showMarkdownPreview ? (
        <CardMarkdownPreview markdownText={props.displaySourceValue} activeDocumentPath={props.markdownDocumentPath} className="min-w-0" uiPanelTextFontClass="font-sans" uiPanelMonospaceTextClass="font-mono text-xs" inlineChipDensity={props.inlineChipDensity} />
      ) : props.displayText ? renderMarkdownSigilInlineText(props.displayText, { keywordChipClassName: DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME, renderKeywordChip: props.renderInlineMediaCandidateChip }) : null}
    </section>
  )
}
