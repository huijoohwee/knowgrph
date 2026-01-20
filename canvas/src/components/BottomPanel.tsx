import { useMemo, useState, useEffect, useRef, useDeferredValue, useCallback, useTransition } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS, UI_LAYOUT } from '@/lib/config'
import { findObjectBoundsById, countLinesUpTo, smoothScrollTextareaToCenter } from '@/lib/editor'
import { scheduleIdle } from '@/features/bottom-panel/utils'
import { type NodeSort, type EdgeSort } from '@/components/BottomPanel/sort'
import { tryFormatJson } from '@/features/code-editor/format'
import { detectIdAroundSelection } from '@/features/code-editor/selection'
import { scrollRowToCenter } from '@/features/tables/scroll'
import { usePanelHotkeys } from '@/features/hooks/usePanelHotkeys'
import { useCodeSelectionSync } from '@/features/hooks/useCodeSelectionSync'
import { useSearchAndSort } from '@/features/hooks/useSearchAndSort'
import { useDragResize } from '@/features/hooks/useDragResize'
import { useCodeJsonEditor } from '@/features/hooks/useCodeJsonEditor'
import { DEFAULT_GRAPH_JSON } from '@/features/panels/constants'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { buildCodeActions } from '@/features/code-editor/actions'
import { DEFAULT_PARSER_SCRIPT_TEXT, useParserUIState } from '@/features/parsers/uiState'
import { useCodeEditorHandlers } from '@/features/hooks/useCodeEditorHandlers'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useParserEditor } from '@/features/parsers/useParserEditor'
import { useBottomPanelSchema } from '@/features/schema-editor/useBottomPanelSchema'
import BottomPanelHeader from '@/components/BottomPanel/BottomPanelHeader'
import BottomPanelBody from '@/components/BottomPanel/BottomPanelBody'
import { BOTTOM_PANEL_OPEN_EVENT, COLLAPSE_STORAGE_KEY, DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO, PARSER_UI_EDITOR_OPEN_STORAGE_KEY } from '@/features/bottom-panel/constants'
import { PANEL_MAX_RATIO } from '@/features/panels/config'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function BottomPanel() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const undoHistory = useGraphStore(s => s.undoHistory)
  const redoHistory = useGraphStore(s => s.redoHistory)
  const codeHighlightDurationMs = useGraphStore(s => s.codeHighlightDurationMs)
  const codeSelectThrottleMs = useGraphStore(s => s.codeSelectThrottleMs)
  const codeHighlightUntilClick = useGraphStore(s => s.codeHighlightUntilClick)
  const graphId = useGraphStore(s => s.graphId)
  const tabId = useGraphStore(s => s.tabId)
  const enableTabSync = useGraphStore(s => s.enableTabSync)
  const bottomPanelHeightRatio = useGraphStore(s => s.bottomPanelHeightRatio)
  const setBottomPanelHeightRatio = useGraphStore(s => s.setBottomPanelHeightRatio)
  const setBottomPanelCollapsed = useGraphStore(s => s.setBottomPanelCollapsed)
  const [collapsed, setCollapsed] = usePersistedBoolean(COLLAPSE_STORAGE_KEY, true)
  const rawTab = useGraphStore(s => s.bottomPanelTab)
  const setTabStore = useGraphStore(s => s.setBottomPanelTab)
  const bottomPanelCurationView = useGraphStore(s => s.bottomPanelCurationView)
  const [, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [parserError, setParserError] = useState('')
  const [parserUiEditorOpen, setParserUiEditorOpen] = usePersistedBoolean(PARSER_UI_EDITOR_OPEN_STORAGE_KEY, true)
  const deferredQuery = useDeferredValue(searchQuery)
  const [nodeSort, setNodeSort] = useState<NodeSort>(null)
  const [edgeSort, setEdgeSort] = useState<EdgeSort>(null)
  const nodeRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const edgeRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const [codeText, setCodeText] = useState('')
  const [codeError, setCodeError] = useState('')
  const codeRef = useRef<MonacoTextEditorHandle | null>(null)
  const blockHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCenteredRef = useRef<string | null>(null)

  const tab: typeof rawTab = rawTab === 'data' ? 'curation' : rawTab

  useEffect(() => {
    if (rawTab !== 'render') return
    emitRendererPanelOpen()
    setTabStore('curation')
  }, [rawTab, setTabStore])

  const clampBottomPanelHeightRatio = useCallback((ratio: number) => {
    if (typeof window === 'undefined') return ratio
    // Allow full screen (covering toolbar) if ratio is at max
    if (ratio >= 0.999) return 1.0

    const vh = window.innerHeight
    if (!Number.isFinite(vh) || vh <= 0) return ratio
    const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar')
    const toolbarBottomPx =
      toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : UI_LAYOUT.toolbarOffsetPx
    const clearancePx = toolbarBottomPx + UI_LAYOUT.toolbarOffsetPx
    const maxRatio = Math.max(0, (vh - clearancePx) / vh)
    return Math.min(ratio, maxRatio)
  }, [])

  const setBottomPanelHeightRatioClamped = useCallback((ratio: number) => {
    setBottomPanelHeightRatio(clampBottomPanelHeightRatio(ratio))
  }, [clampBottomPanelHeightRatio, setBottomPanelHeightRatio])

  useEffect(() => {
    if (selectionSource !== 'canvas') return
    if (!selectedNodeId && !selectedEdgeId) return
    if (bottomPanelHeightRatio < 0.1 || bottomPanelHeightRatio >= PANEL_MAX_RATIO) {
      setBottomPanelHeightRatioClamped(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
    }
  }, [
    selectionSource,
    selectedNodeId,
    selectedEdgeId,
    bottomPanelHeightRatio,
    setBottomPanelHeightRatioClamped,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (collapsed) return
    const clamped = clampBottomPanelHeightRatio(bottomPanelHeightRatio)
    if (!Number.isFinite(clamped)) return
    if (clamped === bottomPanelHeightRatio) return
    setBottomPanelHeightRatio(clamped)
  }, [bottomPanelHeightRatio, clampBottomPanelHeightRatio, collapsed, setBottomPanelHeightRatio])

  useEffect(() => {
    if (tab === 'parser') {
      setParserUiEditorOpen(true)
    }
  }, [tab, setParserUiEditorOpen])

  const {
    schema,
    schemaText,
    setSchemaText,
    schemaError,
    onApplySchema,
    onResetSchema,
    schemaUiEditorOpen,
    setSchemaUiEditorOpen,
    schemaUiStep31Collapsed,
    schemaUiStep32Collapsed,
    setSchemaUiStep31Collapsed,
    setSchemaUiStep32Collapsed,
    schemaUiStep33Collapsed,
    setSchemaUiStep33Collapsed,
    schemaUiStep332Collapsed,
    setSchemaUiStep332Collapsed,
    handleSchemaUiCollapseAll,
    handleSchemaUiExpandAll,
  } = useBottomPanelSchema(tab)

  const stickyBlockRef = useRef<{ start: number; end: number } | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)
  const { applyJson, formatEditor } = useCodeJsonEditor({ codeText, setCodeText, setCodeError, codeRef, setGraphData })

  const parserScriptText = useParserUIState(s => s.scriptText)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const { parserError: parserErrorHook, setParserError: setParserErrorHook, onApplyParser } = useParserEditor()

  const onApply = useCallback(() => { applyJson() }, [applyJson])
  const onRevert = useCallback(() => {
    setCodeText(JSON.stringify(graphData ?? DEFAULT_GRAPH_JSON, null, 2))
    setCodeError('')
  }, [graphData])
  const onResetParser = useCallback(() => {
    try {
      const s = useParserUIState.getState()
      s.setScriptText(DEFAULT_PARSER_SCRIPT_TEXT)
      s.setLastInput('', '')
      s.setSelectedId('')
      s.setPreferredLanguage('json')
    } catch { void 0 }
    setParserError('')
    setParserErrorHook('')
    setParserUiEditorOpen(true)
  }, [setParserErrorHook, setParserError, setParserUiEditorOpen])

  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData])
  const edges = useMemo(() => graphData?.edges ?? [], [graphData])
  const nodeIdSet = useMemo<Set<string>>(() => new Set(nodes.map(n => n.id)), [nodes])
  const edgeIdSet = useMemo<Set<string>>(() => new Set(edges.map(e => e.id)), [edges])
  const isGraphJsonView = tab === 'curation' && bottomPanelCurationView === 'json'
  const isGraphJsonTab = tab === 'code' || isGraphJsonView
  const shouldMirrorGraphJson = isGraphJsonTab
  const graphJsonText = useMemo(() => JSON.stringify(graphData ?? DEFAULT_GRAPH_JSON, null, 2), [graphData])
  const lastSyncedGraphJsonRef = useRef<string>('')

  useEffect(() => {
    if (!shouldMirrorGraphJson) return
    if (codeText === graphJsonText && !codeError) {
      lastSyncedGraphJsonRef.current = graphJsonText
      return
    }

    if (!isGraphJsonTab) {
      if (codeText !== graphJsonText) setCodeText(graphJsonText)
      if (codeError) setCodeError('')
      lastSyncedGraphJsonRef.current = graphJsonText
      return
    }

    const isDirty = codeText !== lastSyncedGraphJsonRef.current
    if (!isDirty) {
      setCodeText(graphJsonText)
      if (codeError) setCodeError('')
      lastSyncedGraphJsonRef.current = graphJsonText
    }
  }, [codeError, codeText, graphJsonText, isGraphJsonTab, shouldMirrorGraphJson])

  const centerNodeRow = useCallback((id: string) => {
    if (!id) return
    if (lastCenteredRef.current === id) return
    const row = nodeRowRefs.current.get(id)
    scrollRowToCenter(row)
    lastCenteredRef.current = id
  }, [])

  const centerEdgeRow = useCallback((id: string) => {
    if (!id) return
    if (lastCenteredRef.current === id) return
    const row = edgeRowRefs.current.get(id)
    scrollRowToCenter(row)
    lastCenteredRef.current = id
  }, [])

  const { sortedNodes, sortedEdges } = useSearchAndSort(
    nodes,
    edges,
    deferredQuery,
    nodeSort,
    setNodeSort,
    edgeSort,
    setEdgeSort,
  )

  const centerIdInCode = useCallback((id: string) => {
    if (lastCenteredRef.current === id) return
    const bounds = findObjectBoundsById(codeText, id)
    if (!bounds) return
    const handle = codeRef.current
    if (!handle) return
    
    handle.revealOffsetInCenter(bounds.start)
    handle.focus()
    handle.setSelectionOffsets(bounds.start, bounds.end)
    
    if (codeHighlightUntilClick) {
      stickyBlockRef.current = bounds
    } else {
      if (blockHighlightTimerRef.current) clearTimeout(blockHighlightTimerRef.current)
      blockHighlightTimerRef.current = setTimeout(() => {
        if (codeRef.current) codeRef.current.setSelectionOffsets(bounds.start, bounds.start)
      }, codeHighlightDurationMs)
    }

    lastCenteredRef.current = id
  }, [codeText, codeHighlightUntilClick, codeHighlightDurationMs])

  useEffect(() => {
    if (!selectedNodeId) return
    setCollapsed(false)
    if (isGraphJsonTab) {
      centerIdInCode(selectedNodeId)
      return
    }
    if (tab !== 'nodes') return
    if (selectionSource === 'canvas') return
    centerNodeRow(selectedNodeId)
  }, [selectedNodeId, tab, selectionSource, centerIdInCode, centerNodeRow, setCollapsed, isGraphJsonTab])

  useEffect(() => {
    if (!selectedEdgeId) return
    setCollapsed(false)
    if (isGraphJsonTab) {
      centerIdInCode(selectedEdgeId)
      return
    }
    if (tab !== 'edges') return
    if (selectionSource === 'canvas') return
    centerEdgeRow(selectedEdgeId)
  }, [selectedEdgeId, tab, selectionSource, centerIdInCode, centerEdgeRow, setCollapsed, isGraphJsonTab])

  useEffect(() => {
    if (collapsed) return
    if (isGraphJsonTab) {
      if (selectedNodeId) {
        centerIdInCode(selectedNodeId)
      } else if (selectedEdgeId) {
        centerIdInCode(selectedEdgeId)
      }
      return
    }
    if (selectionSource === 'canvas') return
    if (tab === 'nodes') {
      if (!selectedNodeId) return
      centerNodeRow(selectedNodeId)
      return
    }
    if (tab === 'edges') {
      if (!selectedEdgeId) return
      centerEdgeRow(selectedEdgeId)
    }
  }, [
    collapsed,
    tab,
    selectedNodeId,
    selectedEdgeId,
    selectionSource,
    centerIdInCode,
    centerNodeRow,
    centerEdgeRow,
    isGraphJsonTab,
  ])
  
  useEffect(() => {
    if (tab !== 'parser') return
    try {
      const s = useParserUIState.getState()
      const current = s.scriptText || ''
      if (!parserLoadOk && !current.trim()) {
        s.setScriptText('')
        setParserError('')
        setParserErrorHook('')
      }
    } catch { void 0 }
  }, [tab, parserLoadOk, setParserError, setParserErrorHook])
  

  useEffect(() => {
    return () => {
      if (codeSelectTimerRef.current) {
        clearTimeout(codeSelectTimerRef.current)
        codeSelectTimerRef.current = null
      }
      if (blockHighlightTimerRef.current) {
        clearTimeout(blockHighlightTimerRef.current)
        blockHighlightTimerRef.current = null
      }
    }
  }, [])

  const { publishCaret } = useCodeSelectionSync({ enableTabSync, graphId, tabId, isGraphJsonView: isGraphJsonTab, codeRef })

  const hotkeyHandlers = useMemo(() => ({ save: applyJson, format: formatEditor, undo: undoHistory, redo: redoHistory, apply: applyJson }), [applyJson, formatEditor, undoHistory, redoHistory])
  usePanelHotkeys(!collapsed && isGraphJsonTab, hotkeyHandlers)

  const [collapsedHeaderPx, setCollapsedHeaderPx] = useState<number>(40)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      if (timer) return
      timer = setTimeout(() => {
        const el = headerRef.current
        if (el) {
          const h = Math.max(24, Math.floor(el.getBoundingClientRect().height))
          setCollapsedHeaderPx(h)
        }
        timer = null
      }, 100)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const onOpen = () => setCollapsed(false)
    window.addEventListener(BOTTOM_PANEL_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(BOTTOM_PANEL_OPEN_EVENT, onOpen)
  }, [setCollapsed])

  useEffect(() => {
    setBottomPanelCollapsed(collapsed)
  }, [collapsed, setBottomPanelCollapsed])

  useEffect(() => {
    const root = document.documentElement
    const vh = window.innerHeight
    const h = collapsed ? collapsedHeaderPx : Math.round(bottomPanelHeightRatio * vh)
    root.style.setProperty('--bottom-panel-height-px', `${h}px`)
  }, [collapsed, collapsedHeaderPx, bottomPanelHeightRatio])

  useDragResize({ collapsed, ratio: bottomPanelHeightRatio, setRatio: setBottomPanelHeightRatioClamped, handleRef: dragHandleRef })

  const codeActions = useMemo(
    () => buildCodeActions(formatEditor, applyJson, graphData, setCodeText, setCodeError, DEFAULT_GRAPH_JSON),
    [formatEditor, applyJson, graphData, setCodeText, setCodeError],
  )

  const handlers = useCodeEditorHandlers({
    codeText,
    setCodeText,
    setCodeError,
    codeSelectThrottleMs,
    publishCaret,
    nodeIdSet,
    edgeIdSet,
    setSelectionSource: v => setSelectionSource(v),
    selectNode,
    selectEdge,
    codeSelectTimerRef,
    stickyBlockRef,
    countLinesUpTo,
    smoothScrollTextareaToCenter,
    detectIdAroundSelection,
    scheduleIdle,
    tryFormatJson,
  })

  const isFullscreen = !collapsed && bottomPanelHeightRatio >= 0.999

  return (
    <aside
      className={`transition-all duration-200 flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-[180]' : 'absolute bottom-0 left-0 right-0 z-[100]'
      }`}
      style={{
        height: collapsed ? `${collapsedHeaderPx}px` : isFullscreen ? '100vh' : `${Math.round(bottomPanelHeightRatio * 100)}vh`,
      }}
    >
      {!collapsed && !isFullscreen && (
        <div
          ref={dragHandleRef}
          className="group h-4 w-full cursor-row-resize bg-transparent select-none pointer-events-auto touch-none flex items-center"
          title={UI_LABELS.dragToResize}
          aria-label="Resize bottom panel"
        >
          <div className={`pointer-events-none mx-auto h-px w-20 rounded-full ${UI_THEME_TOKENS.panel.divider} transition-colors ${UI_THEME_TOKENS.button.hoverBg}`} />
        </div>
      )}
      <section
        ref={panelRef}
        className={`ModalContainer h-full flex flex-col overflow-hidden rounded-none shadow-none p-0 border-t ${UI_THEME_TOKENS.panel.border} border-x-0 border-b-0 ${UI_THEME_TOKENS.panel.bg}`}
      >
        <header ref={headerRef}>
          <BottomPanelHeader
            collapsed={collapsed}
            bottomPanelHeightRatio={bottomPanelHeightRatio}
            tab={tab}
            isGraphJsonView={isGraphJsonTab}
            startTransition={startTransition}
            setTabStore={setTabStore}
            setBottomPanelHeightRatio={setBottomPanelHeightRatioClamped}
            setCollapsed={setCollapsed}
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onToggleSearch={() => setSearchOpen(v => !v)}
            onApply={onApply}
            onApplyParser={onApplyParser}
            onApplySchema={onApplySchema}
            onRevert={onRevert}
            onResetParser={onResetParser}
            onResetSchema={onResetSchema}
          />
        </header>

        {!collapsed && (
          <BottomPanelBody
            tab={tab}
            startTransition={startTransition}
            setTabStore={setTabStore}
            codeActions={codeActions}
            schemaUiEditorOpen={schemaUiEditorOpen}
            setSchemaUiEditorOpen={setSchemaUiEditorOpen}
            schema={schema}
            schemaError={schemaError}
            schemaUiStep31Collapsed={schemaUiStep31Collapsed}
            schemaUiStep32Collapsed={schemaUiStep32Collapsed}
            schemaUiStep33Collapsed={schemaUiStep33Collapsed}
            schemaUiStep332Collapsed={schemaUiStep332Collapsed}
            handleSchemaUiCollapseAll={handleSchemaUiCollapseAll}
            handleSchemaUiExpandAll={handleSchemaUiExpandAll}
            setSchemaUiStep31Collapsed={setSchemaUiStep31Collapsed}
            setSchemaUiStep32Collapsed={setSchemaUiStep32Collapsed}
            setSchemaUiStep33Collapsed={setSchemaUiStep33Collapsed}
            setSchemaUiStep332Collapsed={setSchemaUiStep332Collapsed}
            codeText={codeText}
            codeError={codeError}
            codeRef={codeRef}
            handlers={handlers}
            sortedNodes={sortedNodes}
            selectedNodeId={selectedNodeId}
            sortedEdges={sortedEdges}
            selectedEdgeId={selectedEdgeId}
            parserScriptText={parserScriptText}
            parserError={parserError}
            parserErrorHook={parserErrorHook}
            parserUiEditorOpen={parserUiEditorOpen}
            setParserUiEditorOpen={setParserUiEditorOpen}
            searchQuery={searchQuery}
            nodes={nodes}
            schemaText={schemaText}
            setSchemaText={setSchemaText}
          />
      )}
      </section>
    </aside>
  )
}
