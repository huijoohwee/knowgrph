import React from 'react'
import { CardInlineTextCommandMenus, type CardInlineTextCommandMenuMode } from '@/lib/cards/CardInlineTextCommandMenus'
import { MarkdownInlineTextEditSurface } from '@/lib/markdown-core/ui/MarkdownInlineTextEditSurface'
import type { MarkdownContentEditablePoint } from '@/lib/markdown-core/ui/markdownContentEditableSurface'
import type { CardInlineTextChipDensity } from '@/lib/cards/CardInlineTextEditorSupport'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { readInlineCommandMenuSigilFromInsertedText, readInlineCommandMenuSigilFromKeyEvent } from '@/lib/command-menu/inlineCommandMenuTrigger'
import { readDataViewMultiLineControlClassName, type DataViewFieldLineMode, type DataViewRowHeightPreset } from '@/lib/ui/dataViewDensity'
import { PanelTextInput, PanelTextarea } from '@/lib/ui/panelFormControls'
import { FloatingPanelChatComposerMediaOverlay, TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME, type TextareaInvocationMediaAttachment } from '@/lib/ui/textareaInvocationProjection'
import { UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES, UI_VIEW_EDIT_SURFACE_SHELL_CLASS_NAME } from '@/lib/ui/surfaceClasses'
import { cn } from '@/lib/utils'

type CardInlineTextEditingSurfaceProps = {
  ariaLabel: string
  cardInlineEditInputAttribute: string
  closeCommandMenu: () => void
  commandContextText: string
  commandMode: CardInlineTextCommandMenuMode | null
  commandQuery: string
  commandRootAttribute: string
  commandRootRef: React.RefObject<HTMLElement | null>
  commandSelectionRef: React.MutableRefObject<{ start: number; end: number }>
  commonEditorProps: any
  draft: string
  editorClassName?: string
  editorDensity: { rowHeightPreset: DataViewRowHeightPreset; fieldLineMode: DataViewFieldLineMode }
  enableMarkdownCommandMenus: boolean
  finishProjectedCommandDraft: (nextValue: string) => void
  focusViewerCommandSelection: (start: number, end?: number) => void
  hasProjectedInvocationOverlay: boolean
  hideProjectedCaret: boolean
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  inlineChipDensity: CardInlineTextChipDensity
  isCommandMenuTarget: (target: EventTarget | null) => boolean
  mediaCommandMode: 'inline' | 'external'
  initialViewerSelectionPointRef?: React.MutableRefObject<MarkdownContentEditablePoint | null>
  multiline: boolean
  onCancel: () => void
  onCommit: (forcedValue?: string) => void
  onCommandDraftChange: (nextValue: string) => void
  onMediaCommandSelect?: (candidate: InlineMediaCommandCandidate) => void
  openCommandMenu: (mode: CardInlineTextCommandMenuMode) => void
  openCommandMenuForSigilAtSelection: (sigil: '/' | '@' | '#', selection: { start: number; end: number }) => void
  placeholder: string
  projectedEditorDisplayValue: string
  projectedEditorOverlay: { hasMedia: boolean }
  projectedMediaAttachments: readonly TextareaInvocationMediaAttachment[] | null
  projectedSelectionRange: { start: number; end: number }
  projectedTextareaOverlayTextClassName: string
  projectedTextareaShellClassName: string
  rows?: number
  setCommandMode: (next: CardInlineTextCommandMenuMode | null) => void
  setCommandQuery: (next: string) => void
  setDraft: (next: string) => void
  setProjectedCommandDraft: (next: string) => void
  showCommandLaunchers: boolean
  useViewerEditSurface: boolean
  viewerEditorRef: React.RefObject<HTMLElement | null>
  persistProjectedCommandDraft: (nextValue: string) => void
}

export function CardInlineTextEditingSurface(props: CardInlineTextEditingSurfaceProps) {
  const {
    ariaLabel, cardInlineEditInputAttribute, closeCommandMenu, commandContextText, commandMode, commandQuery, commandRootAttribute,
    commandRootRef, commandSelectionRef, commonEditorProps, draft, editorClassName, editorDensity, enableMarkdownCommandMenus,
    finishProjectedCommandDraft, focusViewerCommandSelection, hasProjectedInvocationOverlay, hideProjectedCaret, inputRef,
    inlineChipDensity, isCommandMenuTarget, mediaCommandMode, initialViewerSelectionPointRef, multiline, onCancel, onCommit, onCommandDraftChange, onMediaCommandSelect, openCommandMenu,
    openCommandMenuForSigilAtSelection, placeholder, projectedEditorDisplayValue, projectedEditorOverlay, projectedMediaAttachments,
    projectedSelectionRange, projectedTextareaOverlayTextClassName, projectedTextareaShellClassName, rows, setCommandMode, setCommandQuery,
    setDraft, setProjectedCommandDraft, showCommandLaunchers, useViewerEditSurface, viewerEditorRef, persistProjectedCommandDraft,
  } = props
  return (
    <section ref={commandRootRef} className={UI_VIEW_EDIT_SURFACE_SHELL_CLASS_NAME} {...UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES} {...{ [commandRootAttribute]: '1' }}>
      {useViewerEditSurface ? (
        <MarkdownInlineTextEditSurface
          value={draft}
          ariaLabel={ariaLabel}
          placeholder={placeholder}
          className={inlineChipDensity === 'compact' ? editorClassName : cn(editorClassName, multiline ? readDataViewMultiLineControlClassName({ rowHeightPreset: editorDensity.rowHeightPreset, fieldLineMode: editorDensity.fieldLineMode }) : '')}
          commandMode={commandMode}
          editorRef={viewerEditorRef}
          enableMarkdownCommandMenus={enableMarkdownCommandMenus}
          inputProxyRef={inputRef as React.RefObject<HTMLTextAreaElement | null>}
          initialSelectionPointRef={initialViewerSelectionPointRef}
          inlineChipDensity={inlineChipDensity}
          multiline={multiline}
          projectedMediaAttachments={projectedMediaAttachments}
          isCommandMenuTarget={isCommandMenuTarget}
          onCancel={onCancel}
          onCommit={onCommit}
          onDraftChange={setDraft}
          onFocus={commonEditorProps.onFocus}
          onSelectionChange={selection => { commandSelectionRef.current = selection }}
          onOpenCommandMenuForSigilAtSelection={openCommandMenuForSigilAtSelection}
          readCommandSigilFromKeyEvent={readInlineCommandMenuSigilFromKeyEvent}
          readCommandSigilFromInsertedText={readInlineCommandMenuSigilFromInsertedText}
          cardInlineEditInputAttribute={cardInlineEditInputAttribute}
        />
      ) : multiline ? (
        <section className={projectedTextareaShellClassName} data-kg-card-inline-text-projected-textarea={hasProjectedInvocationOverlay ? '1' : undefined}>
          {hasProjectedInvocationOverlay ? (
            <FloatingPanelChatComposerMediaOverlay
              input={draft}
              mediaAttachments={null}
              overlayChromeClassName=""
              projectInvocationTokens={false}
              projectedLayoutClassName={TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME}
              projectedSelectionRange={projectedSelectionRange}
              showProjectedCaret={hideProjectedCaret}
              uiPanelTextFontClass={projectedTextareaOverlayTextClassName}
            />
          ) : null}
          <PanelTextarea
            {...commonEditorProps}
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            rows={rows ?? 3}
            rowHeightPreset={editorDensity.rowHeightPreset}
            fieldLineMode={editorDensity.fieldLineMode}
            className={cn(editorClassName, hasProjectedInvocationOverlay ? ['relative z-0 text-transparent', hideProjectedCaret ? 'caret-transparent' : 'caret-[color:var(--kg-text-primary)]'].join(' ') : '')}
            data-kg-card-inline-edit-projected-overlay={hasProjectedInvocationOverlay ? '1' : undefined}
            data-kg-card-inline-edit-media-overlay={projectedEditorOverlay.hasMedia ? '1' : undefined}
          />
        </section>
      ) : (
        <PanelTextInput {...commonEditorProps} ref={inputRef as React.Ref<HTMLInputElement>} type="text" density={editorDensity.rowHeightPreset} />
      )}
      {enableMarkdownCommandMenus ? (
        <CardInlineTextCommandMenus
          commandMode={commandMode}
          commandQuery={commandQuery}
          commandSelectionRef={commandSelectionRef}
          commandContextText={commandContextText}
          draft={useViewerEditSurface ? draft : projectedEditorDisplayValue}
          sourceDraft={draft}
          inputRef={inputRef}
          menuAnchorRef={useViewerEditSurface ? viewerEditorRef : undefined}
          focusSelection={useViewerEditSurface ? focusViewerCommandSelection : undefined}
          mediaCommandMode={mediaCommandMode}
          openCommandMenu={openCommandMenu}
          showLaunchers={showCommandLaunchers}
          closeCommandMenu={closeCommandMenu}
          setCommandQuery={setCommandQuery}
          setCommandMode={setCommandMode}
          setDraft={useViewerEditSurface ? setDraft : setProjectedCommandDraft}
          onCommandDraftChange={useViewerEditSurface ? onCommandDraftChange : persistProjectedCommandDraft}
          onCommandDraftApplied={useViewerEditSurface ? undefined : finishProjectedCommandDraft}
          onMediaCommandSelect={onMediaCommandSelect}
        />
      ) : null}
    </section>
  )
}
