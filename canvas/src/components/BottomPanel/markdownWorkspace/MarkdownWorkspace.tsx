import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { computeMarkdownOutline } from '@/features/markdown-explorer/outline'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import type { MarkdownPreviewPresentationApi } from '@/features/markdown/ui/MarkdownPreview'
import type { HighlightedLineRange } from '@/features/markdown/ui/MarkdownRendererTypes'
import { MarkdownWorkspaceExplorer } from './MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from './MarkdownWorkspaceMain'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX, isMarkdownPath, languageForPath } from './markdownWorkspaceUtils'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { useWorkspaceFileActions } from './useWorkspaceFileActions'
import { useCanvasMarkdownSync } from './useCanvasMarkdownSync'
import { shouldAutosaveWorkspaceFile } from './workspaceAutosave'

const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out = raw.map(v => String(v || '').trim()).filter(Boolean)
  return out
}

export function MarkdownWorkspace() {
  const themeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const setBottomPanelCurationView = useGraphStore(s => s.setBottomPanelCurationView)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const applyMarkdownDocumentToGraph = useGraphStore(s => s.applyMarkdownDocumentToGraph)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const setMarkdownDocumentSourceUrl = useGraphStore(s => s.setMarkdownDocumentSourceUrl)

  const activePath = useMarkdownExplorerStore(s => s.activePath)
  const setActivePath = useMarkdownExplorerStore(s => s.setActivePath)
  const requestedRevealLine = useMarkdownExplorerStore(s => s.requestedRevealLine)
  const requestRevealLine = useMarkdownExplorerStore(s => s.requestRevealLine)

  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [sourcesByPath, setSourcesByPath] = React.useState(() => loadWorkspaceSourceIndex())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>('')
  const [search, setSearch] = React.useState('')
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => lsInt(LS_KEYS.markdownSidebarWidthPx, 320))
  const [sourceFilesCollapsed, setSourceFilesCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, false))
  const [tocCollapsed, setTocCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerOutlineCollapsed, false))
  const [backlinksCollapsed, setBacklinksCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerBacklinksCollapsed, false))
  const [markdownWordWrap, setMarkdownWordWrap] = React.useState(() => lsBool(LS_KEYS.markdownWordWrap, true))
  const [markdownTextHighlight, setMarkdownTextHighlight] = React.useState(() => lsBool(LS_KEYS.markdownTextHighlight, false))
  const [layoutMode, setLayoutMode] = React.useState<MarkdownWorkspaceLayoutMode>(() =>
    lsJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, 'viewer', parseMarkdownWorkspaceLayoutMode),
  )
  const [statusLabel, setStatusLabel] = React.useState<string>('')
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
    const arr = lsJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [] as string[], parseStringArray)
    return new Set((arr || []).map(p => normalizeWorkspacePath(p)))
  })

  const editorRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const workspaceRootRef = React.useRef<HTMLElement | null>(null)
  const presentationApiRef = React.useRef<MarkdownPreviewPresentationApi | null>(null)
  const workspaceFsRef = React.useRef<Awaited<ReturnType<typeof getWorkspaceFs>> | null>(null)
  const [highlightLine, setHighlightLine] = React.useState<number | null>(null)
  const [activeText, setActiveText] = React.useState('')
  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const debouncedText = useDebouncedValue(activeText, 450, activePath)
  const outlineText = useDebouncedValue(activeText, 160, activePath)
  const lastLoadedRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const lastRequestedActivePathRef = React.useRef<{ path: WorkspacePath; atMs: number } | null>(null)

  const activePathRef = React.useRef<WorkspacePath | null>(null)
  activePathRef.current = activePath

  const getFs = React.useCallback(async () => {
    const existing = workspaceFsRef.current
    if (existing) return existing
    const fs = await getWorkspaceFs()
    workspaceFsRef.current = fs
    return fs
  }, [])

  const refresh = React.useCallback(async () => {
    setStatusLabel('Refreshing…')
    setLoading(true)
    setLoadError('')
    try {
      const fs = await getFs()
      await fs.ensureSeed()
      const list = await fs.listEntries()
      const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
      const pruned = list.map(e => {
        if (!e || e.kind !== 'file') return e
        if (typeof e.text !== 'string') return e
        if (e.text.length <= maxInline) return e
        return { ...e, text: undefined }
      })
      setEntries(pruned)
      setSourcesByPath(loadWorkspaceSourceIndex())
      setLoading(false)
      setStatusLabel('Ready')
    } catch (e) {
      setLoading(false)
      setLoadError(String((e as { message?: unknown })?.message ?? e))
      setStatusLabel('Refresh failed')
    }
  }, [getFs])

  const statusClearRef = React.useRef<number | null>(null)
  const setStatusWithAutoClear = React.useCallback((label: string, ttlMs: number = 1400) => {
    setStatusLabel(label)
    if (statusClearRef.current != null) window.clearTimeout(statusClearRef.current)
    statusClearRef.current = window.setTimeout(() => setStatusLabel(''), ttlMs)
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    lsSetInt(LS_KEYS.markdownSidebarWidthPx, sidebarWidthPx, { min: SIDEBAR_MIN_PX, max: SIDEBAR_MAX_PX })
  }, [sidebarWidthPx])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, sourceFilesCollapsed)
  }, [sourceFilesCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerOutlineCollapsed, tocCollapsed)
  }, [tocCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerBacklinksCollapsed, backlinksCollapsed)
  }, [backlinksCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownWordWrap, markdownWordWrap)
  }, [markdownWordWrap])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownTextHighlight, markdownTextHighlight)
  }, [markdownTextHighlight])

  React.useEffect(() => {
    lsSetJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, layoutMode)
  }, [layoutMode])

  React.useEffect(() => {
    lsSetJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [...expandedPaths])
  }, [expandedPaths])

  React.useEffect(() => {
    if (!highlightLine) return
    const id = window.setTimeout(() => setHighlightLine(null), 1500)
    return () => window.clearTimeout(id)
  }, [highlightLine])

  const sidebarWidthPxRef = React.useRef(sidebarWidthPx)
  React.useEffect(() => {
    sidebarWidthPxRef.current = sidebarWidthPx
  }, [sidebarWidthPx])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = sidebarWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = mv.clientX - startX
          const next = Math.max(SIDEBAR_MIN_PX, Math.min(SIDEBAR_MAX_PX, Math.round(startWidth + dx)))
          pending = next
          setSidebarWidthPx(next)
        },
        onEnd: () => setSidebarWidthPx(pending),
        onCancel: () => setSidebarWidthPx(pending),
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])

  const filteredEntries = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return entries
    const keepPaths = new Set<string>()
    for (const e of entries) {
      if (e.kind !== 'file') continue
      if (String(e.name || '').toLowerCase().includes(q) || String(e.text || '').toLowerCase().includes(q)) {
        keepPaths.add(e.path)
      }
    }
    const result: WorkspaceEntry[] = []
    for (const e of entries) {
      if (e.kind === 'folder') {
        result.push(e)
        continue
      }
      if (keepPaths.has(e.path)) result.push(e)
    }
    return result
  }, [entries, search])

  const activeEntry = React.useMemo(() => {
    if (!activePath) return null
    return entries.find(e => e.path === activePath) || null
  }, [activePath, entries])

  const activeEntryIsFile = activeEntry?.kind === 'file'
  const activeDocumentKey = React.useMemo(() => {
    if (!activePath || !activeEntryIsFile) return ''
    return workspaceDocumentKey(activePath)
  }, [activeEntryIsFile, activePath])

  const createParentPath = React.useMemo<WorkspacePath>(() => {
    if (!activeEntry) return WORKSPACE_ROOT_PATH
    if (activeEntry.kind === 'folder') return activeEntry.path
    if (activeEntry.parentPath) return activeEntry.parentPath
    return WORKSPACE_ROOT_PATH
  }, [activeEntry])

  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      setActivePath(normalized)
    },
    [setActivePath],
  )

  const isEditing = layoutMode === 'editor' || layoutMode === 'split'
  const isMarkdown = isMarkdownPath(activePath)

  React.useEffect(() => {
    if (!entries.length) return
    if (loading) return

    if (activePath && entries.some(e => e.path === activePath)) return

    const recent = lastRequestedActivePathRef.current
    if (activePath && recent?.path === activePath && Date.now() - recent.atMs < 2000) return

    const firstFile = entries.find(e => e.kind === 'file')
    if (!firstFile) return
    if (!activePath) {
      setActivePathSafe(firstFile.path)
      setBottomPanelCurationView('markdown')
      return
    }
    setActivePathSafe(firstFile.path)
    setBottomPanelCurationView('markdown')
  }, [activePath, entries, loading, setActivePathSafe, setBottomPanelCurationView])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (!activeEntry) return
    if (activeEntry.kind !== 'folder') return
    if (activePathRef.current !== path) return
    setActiveText('')
    setMarkdownDocument(null, null)
    setMarkdownDocumentSourceUrl(null)
    setHighlightLine(null)
    setStatusLabel('')
  }, [activeEntry, activePath, setMarkdownDocument, setMarkdownDocumentSourceUrl])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (!activeEntryIsFile) return

    const scheduledFor = path

    const cachedText = activeEntry && activeEntry.kind === 'file' && typeof activeEntry.text === 'string' ? String(activeEntry.text ?? '') : null
    const source = sourcesByPath[path]
    const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    setMarkdownDocumentSourceUrl(sourceUrl ? sourceUrl : null)

    const lastLoaded = lastLoadedRef.current
    const canTrustEmptyCache = !!(cachedText === '' && lastLoaded && lastLoaded.path === path && lastLoaded.text === '')
    if (cachedText != null && (cachedText !== '' || canTrustEmptyCache)) {
      if (activePathRef.current !== scheduledFor) return
      lastLoadedRef.current = { path, text: cachedText }
      setActiveText(cachedText)
      if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, cachedText)
      setStatusWithAutoClear('Loaded')
      return
    }

    let cancelled = false
    void (async () => {
      let loadingLabelTimer: number | null = null
      try {
        loadingLabelTimer = window.setTimeout(() => setStatusLabel('Loading…'), 140)
      } catch {
        void 0
      }
      try {
        const fs = await getFs()
        const text = await fs.readFileText(path)
        if (cancelled) return
        if (activePathRef.current !== scheduledFor) return
        const next = String(text ?? '')
        lastLoadedRef.current = { path, text: next }
        setActiveText(next)
        if (typeof activeEntry?.text !== 'string' || activeEntry.text !== next) {
          const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
          const inlineText = next.length <= maxInline ? next : undefined
          setEntries(prev => {
            const idx = prev.findIndex(e => e.path === path)
            if (idx < 0) return prev
            const current = prev[idx]
            if (current.kind !== 'file') return prev
            if (current.text === inlineText) return prev
            const nextEntries = prev.slice()
            nextEntries[idx] = { ...current, text: inlineText }
            return nextEntries
          })
        }
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, next)
        setStatusWithAutoClear('Loaded')
      } catch (e) {
        if (cancelled) return
        if (activePathRef.current !== scheduledFor) return
        setStatusLabel(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      } finally {
        if (loadingLabelTimer != null) window.clearTimeout(loadingLabelTimer)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeDocumentKey,
    activeEntry,
    activeEntryIsFile,
    activePath,
    getFs,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    setStatusWithAutoClear,
    setActiveText,
    setEntries,
    sourcesByPath,
  ])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (!activeEntryIsFile) return
    const last = lastLoadedRef.current
    if (!shouldAutosaveWorkspaceFile({ path, lastLoaded: last, activeText, debouncedText })) return
    void (async () => {
      try {
        setStatusLabel('Saving…')
        const fs = await getFs()
        await fs.writeFileText(path, debouncedText)
        lastLoadedRef.current = { path, text: debouncedText }
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = debouncedText.length <= maxInline ? debouncedText : undefined
        setEntries(prev => prev.map(e => (e.path === path ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, debouncedText)
        setStatusWithAutoClear('Saved')
      } catch (e) {
        setStatusLabel(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    })()
  }, [
    activeDocumentKey,
    activeEntryIsFile,
    activePath,
    activeText,
    debouncedText,
    getFs,
    setMarkdownDocument,
    setStatusWithAutoClear,
    setStatusLabel,
    setEntries,
  ])

  React.useEffect(() => {
    if (!requestedRevealLine) return
    if (!editorRef.current) return
    editorRef.current.revealLine(requestedRevealLine)
    requestRevealLine(null)
  }, [requestRevealLine, requestedRevealLine])

  const revealLineInEditor = React.useCallback(
    (line: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      setHighlightLine(Math.floor(line))
      if (layoutMode !== 'split' && layoutMode !== 'editor') {
        setLayoutMode('split')
      }
      requestRevealLine(Math.floor(line))
    },
    [layoutMode, requestRevealLine, setLayoutMode],
  )

  useCanvasMarkdownSync({
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    setBottomPanelCurationView,
    layoutMode,
    setLayoutMode,
    revealLineInEditor,
    setStatusLabel,
  })

  const showInViewer = React.useCallback(
    (line: number) => {
      setLayoutMode('viewer')
      setHighlightLine(Number.isFinite(line) && line > 0 ? Math.floor(line) : null)
    },
    [setLayoutMode],
  )

  const showInPresentation = React.useCallback(
    (line: number) => {
      setLayoutMode('presentation')
      setHighlightLine(Number.isFinite(line) && line > 0 ? Math.floor(line) : null)
    },
    [setLayoutMode],
  )

  const showInSlidesGallery = React.useCallback(
    (line: number) => {
      setLayoutMode('slides-gallery')
      setHighlightLine(Number.isFinite(line) && line > 0 ? Math.floor(line) : null)
    },
    [setLayoutMode],
  )

  const outline = React.useMemo(() => computeMarkdownOutline(outlineText), [outlineText])
  const backlinksJobRef = React.useRef(0)
  React.useEffect(() => {
    if (backlinksCollapsed || !activePath) {
      setBacklinks([])
      return
    }

    const jobId = ++backlinksJobRef.current
    const run = () => {
      if (backlinksJobRef.current !== jobId) return
      try {
        const next = computeBacklinks({ activePath, entries })
        if (backlinksJobRef.current !== jobId) return
        setBacklinks(next)
      } catch {
        if (backlinksJobRef.current !== jobId) return
        setBacklinks([])
      }
    }

    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 700 })
      return () => {
        try {
          w.cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }

    const t = window.setTimeout(run, 0)
    return () => window.clearTimeout(t)
  }, [activePath, backlinksCollapsed, entries])

  const highlightedLineRange: HighlightedLineRange = React.useMemo(() => {
    if (!highlightLine) return null
    return { start: highlightLine, end: highlightLine }
  }, [highlightLine])

  const toggleExpanded = React.useCallback((path: WorkspacePath) => {
    const normalized = normalizeWorkspacePath(path)
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(normalized)) next.delete(normalized)
      else next.add(normalized)
      return next
    })
  }, [])

  const onSelectFile = React.useCallback(
    (path: WorkspacePath) => {
      setActivePathSafe(path)
      setBottomPanelCurationView('markdown')
    },
    [setActivePathSafe, setBottomPanelCurationView],
  )

  const handleApply = React.useCallback(async () => {
    const name = String(activeDocumentKey || '').trim()
    if (!name) {
      setStatusLabel('No file selected')
      return
    }
    setStatusLabel('Applying…')
    try {
      const ok = await applyMarkdownDocumentToGraph(name, activeText)
      setStatusLabel(ok ? 'Applied' : 'Skipped')
    } catch (e) {
      setStatusLabel(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [activeDocumentKey, activeText, applyMarkdownDocumentToGraph])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const handle = editorRef.current
      if (!handle) return
      const selection = handle.getSelectionOffsets?.() || { startOffset: activeText.length, endOffset: activeText.length }
      const { nextText, nextSelection } = applyMarkdownFormatAction({ text: activeText, selection, action })
      setActiveText(nextText)
      const focusAndSelect = () => {
        const h = editorRef.current
        if (!h) return
        try {
          h.focus?.()
          h.setSelectionOffsets?.(nextSelection.startOffset, nextSelection.endOffset)
        } catch {
          void 0
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(focusAndSelect))
    },
    [activeText],
  )

  const toggleFullscreen = React.useCallback(() => {
    const el = workspaceRootRef.current
    if (!el) return
    try {
      const doc = document as Document & { fullscreenElement?: Element | null; exitFullscreen?: () => Promise<void> }
      if (doc.fullscreenElement) {
        void doc.exitFullscreen?.()
        return
      }
      const req = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
      void req?.call(el)
    } catch {
      void 0
    }
  }, [])

  const fileActions = useWorkspaceFileActions({
    getFs,
    refresh,
    setStatusLabel,
    activePath,
    activeEntryKind: activeEntry?.kind ?? null,
    activeDocumentKey,
    setActiveText,
    setEntries,
    lastLoadedRef,
    setExpandedPaths,
    setActivePathSafe,
    setBottomPanelCurationView,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    applyMarkdownDocumentToGraph,
  })

  const canRefreshActiveFromSource = React.useMemo(() => {
    if (!activePath || !activeEntryIsFile) return false
    const src = sourcesByPath ? sourcesByPath[activePath] : null
    return !!(src && src.kind === 'url' && String((src as { url?: unknown }).url || '').trim())
  }, [activeEntryIsFile, activePath, sourcesByPath])

  const openBacklink = React.useCallback(
    (args: { path: WorkspacePath; line: number }) => {
      setActivePathSafe(args.path)
      revealLineInEditor(args.line)
    },
    [revealLineInEditor, setActivePathSafe],
  )

  const editorUri = activePath ? `inmemory://workspace/${encodeURIComponent(workspaceDocumentKey(activePath) || 'document')}` : 'inmemory://model/empty'
  const editorLanguage = activePath ? languageForPath(activePath) : 'markdown'

  return (
    <section
      ref={workspaceRootRef}
      className="h-full min-h-0 flex overflow-hidden rounded border border-zinc-200/60"
      aria-label="Markdown Workspace"
    >
      <MarkdownWorkspaceExplorer
        sidebarWidthPx={sidebarWidthPx}
        sidebarWidthMinPx={SIDEBAR_MIN_PX}
        sidebarWidthMaxPx={SIDEBAR_MAX_PX}
        entries={entries}
        filteredEntries={filteredEntries}
        sourcesByPath={sourcesByPath}
        loading={loading}
        loadError={loadError}
        expandedPaths={expandedPaths}
        toggleExpanded={toggleExpanded}
        activePath={activePath}
        onSelectFile={onSelectFile}
        search={search}
        setSearch={setSearch}
        sourceFilesCollapsed={sourceFilesCollapsed}
        setSourceFilesCollapsed={setSourceFilesCollapsed}
        tocCollapsed={tocCollapsed}
        setTocCollapsed={setTocCollapsed}
        backlinksCollapsed={backlinksCollapsed}
        setBacklinksCollapsed={setBacklinksCollapsed}
        outline={outline}
        backlinks={backlinks}
        onRevealLine={revealLineInEditor}
        onOpenBacklink={openBacklink}
        onCreateNewFile={() => void fileActions.createNewFile({ parentPath: createParentPath })}
        onCreateNewFolder={() => void fileActions.createNewFolder({ parentPath: createParentPath })}
        onRefresh={() => void refresh()}
        statusLabel={statusLabel}
        activeEntryName={activeEntry?.name || ''}
        activeEntryKind={activeEntry?.kind || ''}
        canClearActiveSelection={fileActions.canClearActiveSelection}
        onClearActiveSelection={fileActions.onClearActiveSelection}
        canRefreshActiveFromSource={canRefreshActiveFromSource}
        onRefreshActiveFromSource={() => {
          if (!activePath || !activeEntryIsFile) return
          void fileActions.refreshFileFromSource(activePath)
        }}
        canDeleteActive={fileActions.canDeleteActive}
        onDeleteActive={fileActions.onDeleteActive}
      />

      <hr
        ref={resizeHandleRef}
        className="w-1 h-full border-0 cursor-col-resize bg-zinc-200/70 hover:bg-zinc-300/70"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize explorer"
      />

      <MarkdownWorkspaceMain
        themeMode={themeMode}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        statusLabel={statusLabel}
        onApply={() => void handleApply()}
        onToggleFullscreen={toggleFullscreen}
        presentationApiRef={presentationApiRef}
        isEditing={isEditing}
        isMarkdown={isMarkdown}
        onFormatAction={handleFormatAction}
        onImportLocalFiles={fileActions.handleImportLocalFiles}
        onImportLocalFolder={fileActions.handleImportLocalFolder}
        onImportUrl={fileActions.handleImportUrl}
        activeText={activeText}
        setActiveText={setActiveText}
        outlineText={outlineText}
        activeDocumentKey={activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        revealLineInEditor={revealLineInEditor}
        showInViewer={showInViewer}
        showInPresentation={showInPresentation}
        showInSlidesGallery={showInSlidesGallery}
        editorUri={editorUri}
        editorLanguage={editorLanguage}
        editorRef={editorRef}
        setHighlightLine={setHighlightLine}
      />
    </section>
  )
}
