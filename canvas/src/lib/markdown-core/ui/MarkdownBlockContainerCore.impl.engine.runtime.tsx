import React from 'react'
import { areReplacementLinesNoop } from '@/features/markdown/ui/markdownEditParitySsot'
import { captureSelectionForFloatingToolbar } from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import { resolveTurnIntoFormatAction } from './markdownBlockContainerCore.toolbar'
import { useMarkdownBlockContainerEdgeTrim } from './markdownBlockContainerCore.edgeTrim'
import { useMarkdownBlockContainerVariableActions } from './markdownBlockContainerCore.variableActions'
import { useMarkdownBlockContainerHtmlFormatting } from './markdownBlockContainerCore.htmlFormatting'
import { useMarkdownBlockContainerMarkdownFormatting } from './markdownBlockContainerCore.markdownFormatting'
import { useMarkdownBlockContainerEditOpenCaretProbe } from './markdownBlockContainerCore.editOpenCaretProbe'
import { useMarkdownBlockContainerSelectionToolbarSync } from './markdownBlockContainerCore.selectionToolbarSync'
import { useMarkdownBlockContainerEditInitialization } from './markdownBlockContainerCore.editInitialization'
import { useMarkdownBlockContainerEditorEvents } from './markdownBlockContainerCore.editorEvents'
import { MarkdownBlockContainerEditSurfaceView } from './markdownBlockContainerCore.editSurfaceView'
import { useMarkdownBlockContainerDraftCommit } from './markdownBlockContainerCore.draftCommit'
import { useMarkdownBlockContainerRuntimeProbe } from './markdownBlockContainerCore.runtimeProbe'
import { useMarkdownBlockContainerHostOrchestration } from './markdownBlockContainerCore.hostOrchestration'
import { useMarkdownBlockContainerLinkPopover } from './markdownBlockContainerCore.linkPopover'
import { useMarkdownBlockContainerInlineUiState } from './markdownBlockContainerCore.inlineUiState'
import {
  cancelMarkdownBlockInlineEditStateSync,
  scheduleMarkdownBlockInlineEditStateSync,
  toMarkdownBlockInlineEditRangeToken,
  toMarkdownBlockInlineEditStateTaskKey,
} from './markdownBlockContainerCore.stateSync'
import { useMarkdownInlineSelectionActions } from './markdownInlineSelectionActions'
import { ensureWordSelectionInRoot } from './markdownBlockContainerCore.interaction'
const MARKDOWN_EDIT_TYPOGRAPHY_SOURCE_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,li,blockquote,section,aside,div,span'
type MarkdownBlockContainerProps = {
  as: React.ElementType
  className?: string
  highlightClass: string
  highlightStyle?: React.CSSProperties
  startLine: number
  endLine?: number
  editLineRange?: { startLine: number; endLine: number }
  resolveEditLineRangeOnOpen?: (eventTarget: HTMLElement | null) => { startLine: number; endLine: number } | null
  resolveEditMinHeightOnOpen?: (eventTarget: HTMLElement | null, currentTarget: HTMLElement) => number | null
  id?: string
  defaultOpen?: boolean
  open?: boolean
  children: React.ReactNode
  inlineEditable?: boolean
  sourceLines?: string[]
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  editorClassName?: string
  editStripLinePrefix?: (line: string) => { prefix: string; content: string }
  editStripLinePrefixSpacingSanitize?: boolean
  editDefaultLinePrefix?: string
  editKeepLinePrefixesInEditor?: boolean
  editTrimEmptyBlockEdges?: boolean
  editEnforceSingleListRoot?: boolean
  editTrimEdgeNewlines?: boolean
  editListMode?: 'ordered' | 'unordered'
  editPresentation?: 'markdown' | 'html'
  editHtmlRender?: 'inline' | 'block'
  editHtmlDisableDefaultBlockFlow?: boolean
  editSigilRenderMode?: 'styled' | 'plain'
  editLeftRailClassName?: string
  forbidCopy?: boolean
  onInlineEditStateChange?: (active: boolean) => void
  editDisableRichUi?: boolean
  editStaticChildren?: React.ReactNode
  editStaticChildrenMode?: 'flow' | 'overlay' | 'passthrough'
  editTypographyMode?: 'inherit' | 'none'
  editPreserveWhitespace?: boolean
  editPreserveBlockHeight?: boolean
  editInlineFlow?: boolean
  editCaptureLayoutSpacing?: boolean
}
export const MarkdownBlockContainer = React.forwardRef<HTMLElement, MarkdownBlockContainerProps & React.HTMLAttributes<HTMLElement>>(({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  editLineRange,
  resolveEditLineRangeOnOpen,
  resolveEditMinHeightOnOpen,
  id,
  children,
  inlineEditable = false,
  sourceLines,
  onReplaceLineRange,
  editorClassName,
  editStripLinePrefix,
  editStripLinePrefixSpacingSanitize = true,
  editDefaultLinePrefix,
  editKeepLinePrefixesInEditor = false,
  editTrimEmptyBlockEdges = false,
  editEnforceSingleListRoot = false,
  editTrimEdgeNewlines = false,
  editListMode,
  editPresentation = 'markdown',
  editHtmlRender = 'inline',
  editHtmlDisableDefaultBlockFlow = false,
  editSigilRenderMode = 'styled',
  editLeftRailClassName,
  forbidCopy = false,
  onInlineEditStateChange,
  editDisableRichUi = false,
  editStaticChildren,
  editStaticChildrenMode = 'flow',
  editTypographyMode = 'inherit',
  editPreserveWhitespace = false,
  editPreserveBlockHeight = true,
  editInlineFlow = false,
  editCaptureLayoutSpacing = false,
  ...rest
}, ref) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')
  const originalOnClick = (rest as React.HTMLAttributes<HTMLElement>).onClick
  const [editing, setEditing] = React.useState(false)
  const inlineSelectionActions = useMarkdownInlineSelectionActions()
  const [sessionEditLineRange, setSessionEditLineRange] = React.useState<{ startLine: number; endLine: number } | null>(null)
  const inlineEditRangeToken = React.useMemo(
    () => toMarkdownBlockInlineEditRangeToken(startLine, endLine),
    [endLine, startLine],
  )
  const inlineEditStateScheduleKey = React.useMemo(
    () => toMarkdownBlockInlineEditStateTaskKey(inlineEditRangeToken),
    [inlineEditRangeToken],
  )
  React.useEffect(() => {
    if (!onInlineEditStateChange) return
    scheduleMarkdownBlockInlineEditStateSync(inlineEditStateScheduleKey, editing, onInlineEditStateChange)
    return () => {
      cancelMarkdownBlockInlineEditStateSync(inlineEditStateScheduleKey)
    }
  }, [editing, inlineEditStateScheduleKey, onInlineEditStateChange])
  React.useEffect(() => {
    if (editing) return
    lastNonCollapsedSelectionOffsetsRef.current = null
    lastNonCollapsedDomRangeRef.current = null
    if (!sessionEditLineRange) return
    setSessionEditLineRange(null)
  }, [editing, sessionEditLineRange])
  const editable = inlineEditable && Array.isArray(sourceLines) && !!onReplaceLineRange && Number.isFinite(startLine)
  const effectiveEndLine = endLine ?? startLine
  const effectiveEditLineRange = sessionEditLineRange || editLineRange || null
  const editStartLine = effectiveEditLineRange && Number.isFinite(effectiveEditLineRange.startLine) ? effectiveEditLineRange.startLine : startLine
  const editEndLine = effectiveEditLineRange && Number.isFinite(effectiveEditLineRange.endLine) ? effectiveEditLineRange.endLine : effectiveEndLine
  const initialText = React.useMemo(() => {
    if (!editable || !sourceLines) return ''
    const startIndex = Math.max(0, Math.floor(editStartLine) - 1)
    const endIndex = Math.max(startIndex + 1, Math.floor(editEndLine))
    return sourceLines.slice(startIndex, endIndex).join('\n')
  }, [editable, editEndLine, editStartLine, sourceLines])
  const draftRef = React.useRef('')
  const editDirtyRef = React.useRef(false)
  const editorRef = React.useRef<HTMLElement | null>(null)
  const hostRef = React.useRef<HTMLElement | null>(null)
  const editTypographySnapshotRef = React.useRef<React.CSSProperties | null>(null)
  const editSpacingSnapshotRef = React.useRef<React.CSSProperties | null>(null)
  const parityProbeSnapshotRef = React.useRef<{
    source: HTMLElement
    sourceMetrics: Record<string, string>
  } | null>(null)
  const initialEditorHtmlRef = React.useRef('')
  const initialPresentTextRef = React.useRef('')
  const editSessionIdRef = React.useRef(0)
  const editLinePrefixesRef = React.useRef<string[] | null>(null)
  const toolbarRef = React.useRef<HTMLElement | null>(null)
  const variableMenuRef = React.useRef<HTMLElement | null>(null)
  const toolbarInteractingRef = React.useRef(false)
  const toolbarInteractionUntilRef = React.useRef(0)
  const selectionSyncSuspendUntilRef = React.useRef(0)
  const linkRangeRef = React.useRef<Range | null>(null)
  const lastNonCollapsedSelectionOffsetsRef = React.useRef<{ startOffset: number; endOffset: number } | null>(null)
  const lastNonCollapsedDomRangeRef = React.useRef<Range | null>(null)
  const editorPresentation = editPresentation === 'html' ? 'html' : 'markdown'
  const htmlRenderMode = editHtmlRender === 'block' ? 'block' : 'inline'
  const normalizeRenderedBlockHtmlForEditor = React.useCallback((renderedHtml: string): string => {
    if (!editListMode) return String(renderedHtml || '').trimEnd()
    return String(renderedHtml || '')
      .replace(/>\s+</g, '><')
      .trim()
  }, [editListMode])
  const {
    edgeTrimRafRef,
    trimEmptyEditableEdges,
    scheduleEdgeTrimBurst,
  } = useMarkdownBlockContainerEdgeTrim({
    editorRef,
    editing,
    editListMode,
    editTrimEmptyBlockEdges,
    editEnforceSingleListRoot,
  })
  const editMinHeightPxRef = React.useRef<number>(0)
  const editOpenBlurGuardUntilRef = React.useRef<number>(0)
  const blurCommitTimerRef = React.useRef<number>(0)
  const lastEditorPointerDownAtRef = React.useRef<number>(0)
  const lastEditorPointerUpAtRef = React.useRef<number>(0)
  const lastDocumentPointerDownTargetRef = React.useRef<Node | null>(null)
  const lastDocumentPointerDownAtRef = React.useRef<number>(0)
  const selectionSyncBurstTokenRef = React.useRef<number>(0)
  const lastBubbleProbeRef = React.useRef<'show' | 'hide' | null>(null)
  const { probe, probeSelection } = useMarkdownBlockContainerRuntimeProbe({
    startLine,
    endLine,
    editing,
    editorRef,
  })
  const {
    readEditorPlainText,
    getSelectionOffsets,
    setSelectionByOffsets,
    setDraftToDom,
    getDraft,
    buildReplacementLinesFromDraft,
    commit,
    cancel,
  } = useMarkdownBlockContainerDraftCommit({
    editable,
    onReplaceLineRange,
    sourceLines,
    editStartLine,
    editEndLine,
    initialText,
    editorPresentation,
    htmlRenderMode,
    normalizeRenderedBlockHtmlForEditor,
    editDefaultLinePrefix,
    hasEditStripLinePrefix: !!editStripLinePrefix,
    editLinePrefixesRef,
    initialPresentTextRef,
    initialEditorHtmlRef,
    draftRef,
    editDirtyRef,
    editSessionIdRef,
    editorRef,
    hostRef,
    setEditing,
    setSessionEditLineRange,
  })
  const {
    readSelectionOffsetsForFormatting,
    execInline,
    insertHtmlAroundSelection,
    applySigilToHtmlSelection,
    restoreCachedHtmlSelection,
  } = useMarkdownBlockContainerHtmlFormatting({
    editorRef,
    getSelectionOffsets,
    setSelectionByOffsets,
    lastNonCollapsedSelectionOffsetsRef,
    lastNonCollapsedDomRangeRef,
  })
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const lastPointerTargetRef = React.useRef<Node | null>(null)
  const lastPointerSelectionModeRef = React.useRef<'caret' | 'word'>('caret')
  const { openEditor, emitParityProbe, placeCaretFromClientPoint } = useMarkdownBlockContainerEditOpenCaretProbe({
    editable,
    typographySelector: MARKDOWN_EDIT_TYPOGRAPHY_SOURCE_SELECTOR,
    editCaptureLayoutSpacing,
    editStripLinePrefix: !!editStripLinePrefix,
    editStripLinePrefixSpacingSanitize,
    probe,
    resolveEditLineRangeOnOpen,
    resolveEditMinHeightOnOpen,
    setSessionEditLineRange,
    setEditing,
    editTypographySnapshotRef,
    editSpacingSnapshotRef,
    parityProbeSnapshotRef,
    editSessionIdRef,
    editOpenBlurGuardUntilRef,
    editMinHeightPxRef,
    lastPointerRef,
    lastPointerTargetRef,
    lastPointerSelectionModeRef,
    editorRef,
    editStartLine,
    editEndLine,
  })
  React.useEffect(() => {
    return () => {
      if (blurCommitTimerRef.current) {
        window.clearTimeout(blurCommitTimerRef.current)
        blurCommitTimerRef.current = 0
      }
    }
  }, [])
  const {
    bubble,
    setBubble,
    slashMenu,
    setSlashMenu,
    variableMenu,
    setVariableMenu,
    linkPopover,
    setLinkPopover,
    bubbleAnchorRef,
    slashAnchorRef,
    variableAnchorRef,
    linkAnchorRef,
    bubbleRafRef,
    bubbleScheduleKey,
    editorMouseUpSyncScheduleKey,
    setSlashMenuStable,
    setVariableMenuStable,
  } = useMarkdownBlockContainerInlineUiState({
    startLine,
    endLine,
  })
  const { applyVariableToken, variableSuggestions } = useMarkdownBlockContainerVariableActions({
    editable,
    sourceLines,
    editStartLine,
    onReplaceLineRange,
    variableMenu,
    setVariableMenu,
    setSlashMenuStable,
    getDraft,
    getSelectionOffsets,
    setDraftToDom,
    setEditing,
    setSessionEditLineRange,
    editorRef,
  })
  const {
    applyDraftAction,
    applyWrap,
    applyTurnInto,
    applyAlign,
    applyToggleHeading,
    applyColor,
    applyHighlightColor,
    applyChecklist,
    applyDivider,
    applyClearFormatting,
    handleDuplicate,
    handleDelete,
  } = useMarkdownBlockContainerMarkdownFormatting({
    editorPresentation,
    editable,
    editStartLine,
    editEndLine,
    sourceLines,
    onReplaceLineRange,
    getDraft,
    getSelectionOffsets,
    setDraftToDom,
    buildReplacementLinesFromDraft,
    resolveTurnIntoFormatAction,
    readEditorPlainText,
    editorRef,
    setEditing,
    setSessionEditLineRange,
    setLinkPopover,
    setBubble,
    linkRangeRef,
    readSelectionOffsetsForFormatting,
    execInline,
    insertHtmlAroundSelection,
    applySigilToHtmlSelection,
    restoreCachedHtmlSelection,
  })
  const {
    holdToolbarInteraction,
    updateBubble,
    syncSelectionToolbarState,
    runSelectionSyncBurst,
  } = useMarkdownBlockContainerSelectionToolbarSync({
    editing,
    editDisableRichUi,
    editorRef,
    getSelectionOffsets,
    setBubble,
    setSlashMenu,
    setLinkPopover,
    toolbarInteractingRef,
    toolbarInteractionUntilRef,
    lastNonCollapsedSelectionOffsetsRef,
    lastNonCollapsedDomRangeRef,
    selectionSyncSuspendUntilRef,
    bubbleRafRef,
    selectionSyncBurstTokenRef,
    lastBubbleProbeRef,
    blurCommitTimerRef,
    bubbleScheduleKey,
    editorMouseUpSyncScheduleKey,
    probe,
  })
  useMarkdownBlockContainerEditInitialization({
    editing,
    initialText,
    editStripLinePrefix,
    editKeepLinePrefixesInEditor,
    editTrimEdgeNewlines,
    editTrimEmptyBlockEdges,
    editListMode,
    editSigilRenderMode,
    editorPresentation,
    htmlRenderMode,
    normalizeRenderedBlockHtmlForEditor,
    placeCaretFromClientPoint,
    runSelectionSyncBurst,
    syncSelectionToolbarState,
    trimEmptyEditableEdges,
    scheduleEdgeTrimBurst,
    editLinePrefixesRef,
    initialPresentTextRef,
    draftRef,
    editDirtyRef,
    editSessionIdRef,
    editorRef,
    initialEditorHtmlRef,
    lastPointerSelectionModeRef,
  })
  React.useEffect(() => {
    if (!editing) return
    if (!editTrimEmptyBlockEdges) return
    scheduleEdgeTrimBurst()
    return () => {
      if (edgeTrimRafRef.current) {
        window.cancelAnimationFrame(edgeTrimRafRef.current)
        edgeTrimRafRef.current = 0
      }
    }
  }, [editing, editTrimEmptyBlockEdges, scheduleEdgeTrimBurst])
  const hasCachedSelection = !!lastNonCollapsedSelectionOffsetsRef.current
    && lastNonCollapsedSelectionOffsetsRef.current.startOffset !== lastNonCollapsedSelectionOffsetsRef.current.endOffset
  const handleVariableMenuMouseDownCapture = React.useCallback(() => {
    toolbarInteractingRef.current = true
    captureSelectionForFloatingToolbar({
      getSelectionOffsets,
      lastNonCollapsedSelectionOffsetsRef,
      lastNonCollapsedDomRangeRef,
    })
  }, [getSelectionOffsets])
  const {
    handleLinkCancel,
    handleLinkHrefChange,
    handleLinkInputKeyDown,
    handleLinkSubmit,
  } = useMarkdownBlockContainerLinkPopover({
    editorPresentation,
    linkPopover,
    setLinkPopover,
    editorRef,
    linkRangeRef,
    getSelectionOffsets,
    getDraft,
    setDraftToDom,
  })
  const {
    onInput: handleEditorInput,
    onCopy: handleEditorCopy,
    onCut: handleEditorCut,
    onBlur: handleEditorBlur,
    onFocus: handleEditorFocus,
    onMouseDown: handleEditorMouseDown,
    onMouseUp: handleEditorMouseUp,
    onDoubleClick: handleEditorDoubleClick,
    onKeyDown: handleEditorKeyDown,
  } = useMarkdownBlockContainerEditorEvents({
    editorRef,
    forbidCopy,
    editPreserveWhitespace,
    readEditorPlainText,
    editStripLinePrefix,
    editLinePrefixesRef,
    editTrimEdgeNewlines,
    draftRef,
    editDirtyRef,
    editTrimEmptyBlockEdges,
    scheduleEdgeTrimBurst,
    emitParityProbe,
    editDisableRichUi,
    getSelectionOffsets,
    setVariableMenuStable,
    variableMenu,
    setSlashMenuStable,
    slashMenu,
    setBubble,
    bubble,
    blurCommitTimerRef,
    selectionSyncSuspendUntilRef,
    toolbarRef,
    variableMenuRef,
    commit,
    toolbarInteractingRef,
    toolbarInteractionUntilRef,
    editOpenBlurGuardUntilRef,
    lastEditorPointerDownAtRef,
    lastEditorPointerUpAtRef,
    lastDocumentPointerDownAtRef,
    lastDocumentPointerDownTargetRef,
    lastNonCollapsedSelectionOffsetsRef,
    lastNonCollapsedDomRangeRef,
    editorMouseUpSyncScheduleKey,
    syncSelectionToolbarState,
    runSelectionSyncBurst,
    cancel,
    applyVariableToken,
    linkRangeRef,
    setLinkPopover,
  })
  const handleHostDoubleClickWhileEditing = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    lastPointerSelectionModeRef.current = 'word'
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    lastPointerTargetRef.current = event.target instanceof Node ? event.target : null
    const currentTarget = (editorRef.current || event.currentTarget) as HTMLElement
    handleEditorDoubleClick({
      detail: 2,
      currentTarget,
      target: event.target as EventTarget,
      stopPropagation: () => {},
      preventDefault: () => {},
    } as unknown as React.MouseEvent<HTMLElement>)
    window.requestAnimationFrame(() => {
      const root = editorRef.current
      if (!root) return
      const sel = typeof window !== 'undefined' ? window.getSelection() : null
      if (sel && String(sel.toString() || '').trim().length > 0) return
      ensureWordSelectionInRoot(root)
      runSelectionSyncBurst(() => syncSelectionToolbarState())
    })
  }, [handleEditorDoubleClick, runSelectionSyncBurst, syncSelectionToolbarState])
  const { setHostNodeRef, onHostClick, onHostDoubleClick } = useMarkdownBlockContainerHostOrchestration({
    editing,
    hostRef,
    forwardedRef: ref,
    editorRef,
    lastDocumentPointerDownTargetRef,
    lastDocumentPointerDownAtRef,
    originalOnClick,
    openEditor,
    onEditingHostDoubleClick: handleHostDoubleClickWhileEditing,
    probe,
    probeSelection,
  })
  return (
    <Tag
      ref={setHostNodeRef}
      {...(rest as unknown as Record<string, unknown>)}
      id={id}
      className={cls}
      style={highlightStyle}
      data-start-line={startLine}
      data-end-line={endLine ?? startLine}
      onClick={onHostClick}
      onDoubleClick={onHostDoubleClick}
    >
      <MarkdownBlockContainerEditSurfaceView
        editing={editing}
        editable={editable}
        children={children}
        hostTag={Tag}
        editInlineFlow={editInlineFlow}
        editPreserveBlockHeight={editPreserveBlockHeight}
        editMinHeightPx={editMinHeightPxRef.current}
        editStaticChildren={editStaticChildren}
        editStaticChildrenMode={editStaticChildrenMode}
        editLeftRailClassName={editLeftRailClassName}
        bubble={bubble}
        slashMenu={slashMenu}
        variableMenu={variableMenu}
        linkPopover={linkPopover}
        bubbleAnchorRef={bubbleAnchorRef}
        slashAnchorRef={slashAnchorRef}
        variableAnchorRef={variableAnchorRef}
        linkAnchorRef={linkAnchorRef}
        toolbarRef={toolbarRef}
        variableMenuRef={variableMenuRef}
        editDisableRichUi={editDisableRichUi}
        hasCachedSelection={hasCachedSelection}
        holdToolbarInteraction={holdToolbarInteraction}
        onToolbarInteractionEnd={() => {
          queueMicrotask(() => {
            toolbarInteractingRef.current = false
          })
        }}
        applyTurnInto={applyTurnInto}
        applyToggleHeading={applyToggleHeading}
        applyAlign={applyAlign}
        applyDraftAction={applyDraftAction}
        applyWrap={applyWrap}
        applyHighlightColor={applyHighlightColor}
        applyColor={applyColor}
        applyClearFormatting={applyClearFormatting}
        applyChecklist={applyChecklist}
        applyDivider={applyDivider}
        handleDuplicate={handleDuplicate}
        handleDelete={handleDelete}
        selectionActions={inlineSelectionActions ? {
          startLine,
          endLine: endLine ?? startLine,
          currentView: inlineSelectionActions.currentView,
          onShowOnCanvas: inlineSelectionActions.onShowOnCanvas,
          onShowInViewer: inlineSelectionActions.onShowInViewer,
          onShowInEditor: inlineSelectionActions.onShowInEditor,
          onShowInPresentation: inlineSelectionActions.onShowInPresentation,
          onShowInSlidesGallery: inlineSelectionActions.onShowInSlidesGallery,
          onShowInGraphDataTable: inlineSelectionActions.onShowInGraphDataTable,
        } : null}
        onVariableMenuMouseDownCapture={handleVariableMenuMouseDownCapture}
        setSlashMenuStable={setSlashMenuStable}
        setVariableMenu={setVariableMenu}
        variableSuggestions={variableSuggestions}
        applyVariableToken={applyVariableToken}
        onLinkSubmit={handleLinkSubmit}
        onLinkHrefChange={handleLinkHrefChange}
        onLinkInputKeyDown={handleLinkInputKeyDown}
        onLinkCancel={handleLinkCancel}
        editorRef={editorRef}
        editorClassName={editorClassName}
        editTypographyMode={editTypographyMode}
        editTypographySnapshot={editTypographySnapshotRef.current}
        editSpacingSnapshot={editSpacingSnapshotRef.current}
        editListMode={editListMode}
        editPresentation={editorPresentation}
        editHtmlRender={htmlRenderMode}
        editHtmlDisableDefaultBlockFlow={editHtmlDisableDefaultBlockFlow}
        onInput={handleEditorInput}
        onCopy={handleEditorCopy}
        onCut={handleEditorCut}
        onBlur={handleEditorBlur}
        onFocus={handleEditorFocus}
        onMouseDown={handleEditorMouseDown}
        onMouseUp={handleEditorMouseUp}
        onDoubleClick={handleEditorDoubleClick}
        onKeyDown={handleEditorKeyDown}
      />
    </Tag>
  )
})
