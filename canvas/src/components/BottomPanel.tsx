import { useMemo, useState, useEffect, useRef, useDeferredValue, useCallback, useTransition } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS, UI_LAYOUT } from '@/lib/config'
import { type NodeSort, type EdgeSort } from '@/components/BottomPanel/sort'
import { scrollRowToCenter } from '@/features/tables/scroll'
import { useSearchAndSort } from '@/features/hooks/useSearchAndSort'
import { useDragResize } from '@/features/hooks/useDragResize'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { DEFAULT_PARSER_SCRIPT_TEXT, useParserUIState } from '@/features/parsers/uiState'
import { useParserEditor } from '@/features/parsers/useParserEditor'
import { useBottomPanelSchema } from '@/features/schema-editor/useBottomPanelSchema'
import BottomPanelHeader from '@/components/BottomPanel/BottomPanelHeader'
import BottomPanelBody from '@/components/BottomPanel/BottomPanelBody'
import { BOTTOM_PANEL_OPEN_EVENT, COLLAPSE_STORAGE_KEY, DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO, PARSER_UI_EDITOR_OPEN_STORAGE_KEY } from '@/features/bottom-panel/constants'
import { PANEL_MAX_RATIO } from '@/features/panels/config'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'

export default function BottomPanel() {
  const activeGraphData = useActiveGraphData()
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const bottomPanelHeightRatio = useGraphStore(s => s.bottomPanelHeightRatio)
  const setBottomPanelHeightRatio = useGraphStore(s => s.setBottomPanelHeightRatio)
  const setBottomPanelCollapsed = useGraphStore(s => s.setBottomPanelCollapsed)
  const [collapsed, setCollapsed] = usePersistedBoolean(COLLAPSE_STORAGE_KEY, true)
  const rawTab = useGraphStore(s => s.bottomPanelTab)
  const setTabStore = useGraphStore(s => s.setBottomPanelTab)
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
  const lastCenteredRef = useRef<string | null>(null)

  const tab: typeof rawTab = rawTab

  const keepBodyMountedWhenCollapsed = false

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
      typeof HTMLElement !== 'undefined' && toolbar instanceof HTMLElement
        ? toolbar.getBoundingClientRect().bottom
        : UI_LAYOUT.toolbarOffsetPx
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

  const panelRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)

  const parserScriptText = useParserUIState(s => s.scriptText)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const { parserError: parserErrorHook, setParserError: setParserErrorHook, onApplyParser } = useParserEditor()

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

  const nodes = useMemo(() => activeGraphData?.nodes ?? [], [activeGraphData])
  const edges = useMemo(() => activeGraphData?.edges ?? [], [activeGraphData])
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

  useEffect(() => {
    if (!selectedNodeId) return
    setCollapsed(false)
    if (tab !== 'curation') return
    if (selectionSource === 'canvas') return
    centerNodeRow(selectedNodeId)
  }, [centerNodeRow, selectedNodeId, selectionSource, setCollapsed, tab])

  useEffect(() => {
    if (!selectedEdgeId) return
    setCollapsed(false)
    if (tab !== 'curation') return
    if (selectionSource === 'canvas') return
    centerEdgeRow(selectedEdgeId)
  }, [centerEdgeRow, selectedEdgeId, selectionSource, setCollapsed, tab])
  
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
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const vh = window.innerHeight
    const h = collapsed ? collapsedHeaderPx : Math.round(bottomPanelHeightRatio * vh)
    root.style.setProperty('--bottom-panel-height-px', `${h}px`)
  }, [collapsed, collapsedHeaderPx, bottomPanelHeightRatio])

  useDragResize({ collapsed, ratio: bottomPanelHeightRatio, setRatio: setBottomPanelHeightRatioClamped, handleRef: dragHandleRef })

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
            startTransition={startTransition}
            setTabStore={setTabStore}
            setBottomPanelHeightRatio={setBottomPanelHeightRatioClamped}
            setCollapsed={setCollapsed}
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onToggleSearch={() => setSearchOpen(v => !v)}
            onApplyParser={onApplyParser}
            onApplySchema={onApplySchema}
            onResetParser={onResetParser}
            onResetSchema={onResetSchema}
          />
        </header>

        {(!collapsed || keepBodyMountedWhenCollapsed) && (
          <section
            className={
              collapsed
                ? 'h-0 overflow-hidden pointer-events-none'
                : 'flex-1 min-h-0'
            }
            aria-hidden={collapsed}
          >
            <BottomPanelBody
              tab={tab}
              startTransition={startTransition}
              setTabStore={setTabStore}
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
          </section>
        )}
      </section>
    </aside>
  )
}
