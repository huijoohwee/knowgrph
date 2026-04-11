import React from 'react'
import {
  FLOATING_MENU_BUTTON_CLASSNAME,
  FLOATING_MENU_BUTTON_DANGER_CLASSNAME,
  FLOATING_MENU_BUTTON_DISABLED_CLASSNAME,
  FLOATING_MENU_DIVIDER_CLASSNAME,
  FLOATING_BUBBLE_TOOLBAR_CLASSNAME,
  FLOATING_BUBBLE_BUTTON_CLASSNAME,
  FLOATING_POPOVER_PANEL_CLASSNAME,
  FLOATING_POPOVER_INPUT_CLASSNAME,
  FLOATING_MENU_LEFT_W220_CLASSNAME,
} from '@/components/BottomPanel/markdownWorkspace/main/viewer/floatingMenuStyles'
import { MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES } from '@/features/markdown/ui/markdownInlineCodeParity'
import { MarkdownBlockContainerBubbleToolbarOverlay } from './markdownBlockContainerCore.bubbleToolbarOverlay'
import { MarkdownBlockContainerInlineMenusOverlay } from './markdownBlockContainerCore.inlineMenusOverlay'

export const MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS =
  '[caret-color:inherit] focus:outline-none focus-visible:outline-none'

export const MarkdownBlockContainerEditSurfaceView = (props: {
  editing: boolean
  editable: boolean
  children: React.ReactNode
  hostTag: React.ElementType
  editInlineFlow: boolean
  editPreserveBlockHeight: boolean
  editMinHeightPx: number
  editStaticChildren?: React.ReactNode
  editLeftRailClassName?: string
  bubble: { show: boolean; leftPx: number; topPx: number }
  slashMenu: { show: boolean; leftPx: number; topPx: number }
  variableMenu: { show: boolean; leftPx: number; topPx: number; query: string; keyInput: string; valueInput: string; fallbackInput: string; mode: 'ref' | 'create' | 'update' | 'fallback' | 'delete' }
  linkPopover: { show: boolean; leftPx: number; topPx: number; href: string }
  bubbleAnchorRef: React.RefObject<HTMLSpanElement | null>
  slashAnchorRef: React.RefObject<HTMLSpanElement | null>
  variableAnchorRef: React.RefObject<HTMLSpanElement | null>
  linkAnchorRef: React.RefObject<HTMLSpanElement | null>
  toolbarRef: React.RefObject<HTMLElement | null>
  variableMenuRef: React.RefObject<HTMLElement | null>
  editDisableRichUi: boolean
  hasCachedSelection: boolean
  holdToolbarInteraction: () => void
  onToolbarInteractionEnd: () => void
  applyTurnInto: (next: string) => void
  applyToggleHeading: (level: 1 | 2 | 3) => void
  applyAlign: (next: string) => void
  applyDraftAction: (action: 'bold' | 'inlineCode' | 'italic' | 'link' | 'strike' | 'heading2' | 'bulletList' | 'numberedList' | 'blockquote') => void
  applyWrap: (left: string, right: string) => void
  applyHighlightColor: (color: string) => void
  applyColor: (color: string) => void
  applyClearFormatting: () => void
  applyChecklist: () => void
  applyDivider: () => void
  handleDuplicate: () => void
  handleDelete: () => void
  selectionActions?: {
    startLine: number
    endLine: number
    currentView: import('grph-shared/ssot/types').SsotSurface
    onShowOnCanvas: (startLine: number, endLine: number) => void
    onShowInViewer: (line: number) => void
    onShowInEditor: (line: number) => void
    onShowInPresentation: (line: number) => void
    onShowInSlidesGallery: (line: number) => void
    onShowInGraphDataTable: (line: number) => void
  } | null
  onVariableMenuMouseDownCapture: () => void
  setSlashMenuStable: (next: { show: boolean; leftPx: number; topPx: number }) => void
  setVariableMenu: React.Dispatch<React.SetStateAction<{ show: boolean; leftPx: number; topPx: number; query: string; keyInput: string; valueInput: string; fallbackInput: string; mode: 'ref' | 'create' | 'update' | 'fallback' | 'delete' }>>
  variableSuggestions: Array<{ key: string; value?: string | null; source?: string }>
  applyVariableToken: (mode: 'ref' | 'create' | 'update' | 'fallback' | 'delete', forcedKey?: string) => void
  onLinkSubmit: (event: React.FormEvent) => void
  onLinkHrefChange: (value: string) => void
  onLinkInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onLinkCancel: () => void
  editorRef: React.RefObject<HTMLElement | null>
  editorClassName?: string
  editTypographyMode: 'inherit' | 'none'
  editTypographySnapshot?: React.CSSProperties | null
  editSpacingSnapshot?: React.CSSProperties | null
  editListMode?: 'ordered' | 'unordered'
  editPresentation: 'markdown' | 'html'
  editHtmlRender: 'inline' | 'block'
  editHtmlDisableDefaultBlockFlow: boolean
  onInput: () => void
  onCopy: (event: React.ClipboardEvent<HTMLElement>) => void
  onCut: (event: React.ClipboardEvent<HTMLElement>) => void
  onBlur: (event: React.FocusEvent<HTMLElement>) => void
  onFocus: () => void
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void
  onMouseUp: (event: React.MouseEvent<HTMLElement>) => void
  onDoubleClick: (event: React.MouseEvent<HTMLElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
}) => {
  if (!(props.editing && props.editable)) return <>{props.children}</>
  const hostInlineFlow = props.hostTag === 'p' || props.hostTag === 'li' || props.hostTag === 'th' || props.hostTag === 'td'
  const effectiveInlineFlow = props.editInlineFlow || hostInlineFlow
  const htmlBlockEditing = props.editPresentation === 'html' && props.editHtmlRender === 'block'
  const htmlInlineEditing = props.editPresentation === 'html' && props.editHtmlRender === 'inline'
  const EditorTag = (
    htmlBlockEditing
      ? 'div'
      : htmlInlineEditing
        ? 'span'
        : ((!effectiveInlineFlow && !hostInlineFlow) ? 'div' : 'span')
  ) as 'div' | 'span'
  const htmlEditNormalizeClassName =
    props.editPresentation === 'html'
      ? [
          '[&_p]:m-0',
          '[&_div]:m-0',
          '[&_h1]:m-0',
          '[&_h2]:m-0',
          '[&_h3]:m-0',
          '[&_h4]:m-0',
          '[&_h5]:m-0',
          '[&_h6]:m-0',
          '[&_h1]:text-inherit',
          '[&_h2]:text-inherit',
          '[&_h3]:text-inherit',
          '[&_h4]:text-inherit',
          '[&_h5]:text-inherit',
          '[&_h6]:text-inherit',
          '[&_h1]:font-inherit',
          '[&_h2]:font-inherit',
          '[&_h3]:font-inherit',
          '[&_h4]:font-inherit',
          '[&_h5]:font-inherit',
          '[&_h6]:font-inherit',
          '[&_div]:text-inherit',
          '[&_div]:font-inherit',
          '[&_div]:leading-normal',
          '[&_div]:whitespace-pre-wrap',
          '[&_li]:text-inherit',
          '[&_li]:font-inherit',
          '[&_ul]:m-0',
          '[&_ol]:m-0',
          '[&_blockquote]:m-0',
          '[&_pre]:m-0',
          '[&_hr]:m-0',
          '[&>*:first-child]:mt-0',
          '[&>*:last-child]:mb-0',
          '[&_p:first-child]:mt-0',
          '[&_p:last-child]:mb-0',
          '[&_ul:first-child]:mt-0',
          '[&_ul:last-child]:mb-0',
          '[&_ol:first-child]:mt-0',
          '[&_ol:last-child]:mb-0',
          '[&_blockquote:first-child]:mt-0',
          '[&_blockquote:last-child]:mb-0',
          '[&_a]:break-words',
          '[&_a]:text-blue-600',
          '[&_a]:hover:underline',
          ...MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES,
          '[&_mark]:px-0.5',
          '[&_mark]:rounded-sm',
          '[&_mark]:text-yellow-700',
          '[&_mark]:bg-yellow-50',
          '[&_mark]:border',
          '[&_mark]:border-yellow-200',
          'dark:[&_mark]:text-yellow-400',
          'dark:[&_mark]:bg-yellow-900/30',
          'dark:[&_mark]:border-yellow-800',
        ].join(' ')
      : ''
  const htmlEditBlockFlowClassName =
    props.editPresentation === 'html' && props.editHtmlRender === 'block' && !props.editHtmlDisableDefaultBlockFlow
      ? [
          '[&_p]:mt-2',
          '[&_p]:mb-2',
          '[&_ul]:mt-3',
          '[&_ul]:mb-3',
          '[&_ul]:pl-5',
          '[&_ul]:list-disc',
          '[&_ol]:mt-3',
          '[&_ol]:mb-3',
          '[&_ol]:pl-5',
          '[&_ol]:list-decimal',
          '[&_li]:mt-0',
          '[&_li]:mb-0',
          '[&_blockquote]:mt-4',
          '[&_blockquote]:mb-4',
          '[&_blockquote]:pl-4',
          '[&_blockquote]:py-2',
          '[&_blockquote]:border-l-4',
          '[&_blockquote]:border-blue-400',
          'dark:[&_blockquote]:border-blue-600',
          '[&_blockquote]:italic',
        ].join(' ')
      : ''

  return (
    <span
      className={effectiveInlineFlow
        ? (hostInlineFlow ? 'relative inline-block w-full min-w-0 align-baseline' : 'relative inline min-w-0 align-baseline')
        : 'relative w-full block min-w-0 flex-1'}
      style={props.editPreserveBlockHeight && props.editMinHeightPx > 0 ? { minHeight: `${props.editMinHeightPx}px` } : undefined}
    >
      {props.editStaticChildren ? (
        <span className={`pointer-events-none select-none ${effectiveInlineFlow ? 'inline align-baseline' : 'block'}`}>{props.editStaticChildren}</span>
      ) : null}
      {props.editLeftRailClassName ? <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-20 ${props.editLeftRailClassName}`} /> : null}
      <span ref={props.bubbleAnchorRef} className="absolute w-px h-px" style={{ left: `${props.bubble.leftPx}px`, top: `${props.bubble.topPx}px` }} />
      <span ref={props.slashAnchorRef} className="absolute w-px h-px" style={{ left: `${props.slashMenu.leftPx}px`, top: `${props.slashMenu.topPx}px` }} />
      <span ref={props.variableAnchorRef} className="absolute w-px h-px" style={{ left: `${props.variableMenu.leftPx}px`, top: `${props.variableMenu.topPx}px` }} />
      <span ref={props.linkAnchorRef} className="absolute w-px h-px" style={{ left: `${props.linkPopover.leftPx}px`, top: `${props.linkPopover.topPx}px` }} />

      <MarkdownBlockContainerBubbleToolbarOverlay
        show={!props.editDisableRichUi && (props.bubble.show || props.hasCachedSelection)}
        anchorRef={props.bubbleAnchorRef}
        toolbarRef={props.toolbarRef}
        holdToolbarInteraction={props.holdToolbarInteraction}
        onToolbarInteractionEnd={props.onToolbarInteractionEnd}
        floatingBubbleToolbarClassName={FLOATING_BUBBLE_TOOLBAR_CLASSNAME}
        floatingBubbleButtonClassName={FLOATING_BUBBLE_BUTTON_CLASSNAME}
        floatingMenuButtonDangerClassName={FLOATING_MENU_BUTTON_DANGER_CLASSNAME}
        floatingMenuButtonDisabledClassName={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME}
        toolbarMenuClassName={FLOATING_MENU_LEFT_W220_CLASSNAME}
        toolbarMenuButtonClassName={FLOATING_MENU_BUTTON_CLASSNAME}
        toolbarMenuDividerClassName={FLOATING_MENU_DIVIDER_CLASSNAME}
        toolbarMenuSummaryClassName={FLOATING_BUBBLE_BUTTON_CLASSNAME}
        applyTurnInto={props.applyTurnInto}
        applyToggleHeading={props.applyToggleHeading}
        applyAlign={props.applyAlign}
        applyDraftAction={props.applyDraftAction}
        applyWrap={props.applyWrap}
        applyHighlightColor={props.applyHighlightColor}
        applyColor={props.applyColor}
        applyClearFormatting={props.applyClearFormatting}
        applyChecklist={props.applyChecklist}
        applyDivider={props.applyDivider}
        handleDuplicate={props.handleDuplicate}
        handleDelete={props.handleDelete}
        selectionActions={props.selectionActions}
      />

      <EditorTag
        ref={(node: HTMLElement | null) => {
          ;(props.editorRef as React.MutableRefObject<HTMLElement | null>).current = node
        }}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="Edit markdown block"
        className={[
          props.editorClassName || 'w-full min-h-[24px] whitespace-pre-wrap break-words outline-none bg-transparent',
          MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS,
          htmlBlockEditing ? 'block' : '',
          htmlEditNormalizeClassName,
          htmlEditBlockFlowClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          ...(props.editTypographyMode === 'inherit'
            ? { font: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit', ...(props.editTypographySnapshot || null) }
            : {}),
          ...(props.editSpacingSnapshot || null),
          ...(props.editListMode
            ? { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
            : {}),
        }}
        onInput={props.onInput}
        onCopy={props.onCopy}
        onCut={props.onCut}
        onBlur={props.onBlur}
        onFocus={props.onFocus}
        onMouseDown={props.onMouseDown}
        onMouseUp={props.onMouseUp}
        onDoubleClick={props.onDoubleClick}
        onKeyDown={props.onKeyDown}
      />

      <MarkdownBlockContainerInlineMenusOverlay
        editDisableRichUi={props.editDisableRichUi}
        slashMenu={props.slashMenu}
        variableMenu={props.variableMenu}
        linkPopover={props.linkPopover}
        slashAnchorRef={props.slashAnchorRef}
        variableAnchorRef={props.variableAnchorRef}
        linkAnchorRef={props.linkAnchorRef}
        variableMenuRef={props.variableMenuRef}
        onToolbarInteract={props.holdToolbarInteraction}
        onVariableMenuMouseDownCapture={props.onVariableMenuMouseDownCapture}
        setSlashMenuStable={props.setSlashMenuStable}
        applyDraftAction={(action) => props.applyDraftAction(action)}
        applyToggleHeading={props.applyToggleHeading}
        setVariableMenu={props.setVariableMenu}
        variableSuggestions={props.variableSuggestions}
        applyVariableToken={props.applyVariableToken}
        floatingMenuLeftW220ClassName={FLOATING_MENU_LEFT_W220_CLASSNAME}
        floatingMenuButtonClassName={FLOATING_MENU_BUTTON_CLASSNAME}
        floatingMenuButtonDangerClassName={FLOATING_MENU_BUTTON_DANGER_CLASSNAME}
        floatingPopoverPanelClassName={FLOATING_POPOVER_PANEL_CLASSNAME}
        floatingPopoverInputClassName={FLOATING_POPOVER_INPUT_CLASSNAME}
        floatingBubbleButtonClassName={FLOATING_BUBBLE_BUTTON_CLASSNAME}
        onLinkSubmit={props.onLinkSubmit}
        onLinkHrefChange={props.onLinkHrefChange}
        onLinkInputKeyDown={props.onLinkInputKeyDown}
        onLinkCancel={props.onLinkCancel}
      />
    </span>
  )
}
