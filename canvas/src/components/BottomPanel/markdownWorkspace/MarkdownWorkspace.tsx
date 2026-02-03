import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi } from './markdownWorkspaceTypes'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { extractFencedCodeBlocks } from '@/lib/markdown/extractFencedCodeBlocks'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from 'gympgrph'
import { MarkdownWorkspaceExplorer } from './MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from './MarkdownWorkspaceMain'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX, isMarkdownPath, languageForPath } from './markdownWorkspaceUtils'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { useWorkspaceFileActions } from './useWorkspaceFileActions'
import { useCanvasMarkdownSync } from './useCanvasMarkdownSync'
import { subscribeWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { shouldAutosaveWorkspaceFile } from './workspaceAutosave'
import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'

const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out = raw.map(v => String(v || '').trim()).filter(Boolean)
  return out
}

const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))

export function MarkdownWorkspace() {
  const themeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const bottomPanelCollapsed = useGraphStore(s => s.bottomPanelCollapsed)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const editorWorkspaceSection = useGraphStore(s => s.editorWorkspaceSection)
  const effectiveBottomPanelCollapsed = workspaceViewMode === 'editor' ? false : bottomPanelCollapsed
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

  const editorRef = React.useRef<HTMLTextAreaElement | null>(null)
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const workspaceRootRef = React.useRef<HTMLElement | null>(null)
  const presentationApiRef = React.useRef<MarkdownPresentationApi | null>(null)

  const geoDatasetIntegration = React.useMemo(
    () =>
      createMarkdownGeoDatasetIntegration({
        requestOpenGeoPanel: () => {
          try {
            setGeospatialModeEnabled(true)
          } catch {
            void 0
          }
          emitSidePanelOpen({ tab: 'geo', open: true })
        },
      }),
    [],
  )
  const workspaceFsRef = React.useRef<Awaited<ReturnType<typeof getWorkspaceFs>> | null>(null)
  const [highlightedLineRange, setHighlightedLineRange] = React.useState<HighlightedLineRange>(null)
  const [activeText, setActiveText] = React.useState('')
  const activeTextRef = React.useRef('')
  activeTextRef.current = activeText
  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const debouncedText = useDebouncedValue(activeText, 450, activePath)
  const outlineText = useDebouncedValue(activeText, 160, activePath)
  const lastLoadedRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const collapsedSnapshotRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const prevCollapsedRef = React.useRef<boolean>(effectiveBottomPanelCollapsed)
  const lastRequestedActivePathRef = React.useRef<{ path: WorkspacePath; atMs: number } | null>(null)
  const lastSetActivePath = useMarkdownExplorerStore(s => s.lastSetActivePath)

  const activePathRef = React.useRef<WorkspacePath | null>(null)
  activePathRef.current = activePath

  const [selectionPath, setSelectionPath] = React.useState<WorkspacePath | null>(null)
  const selectionPathRef = React.useRef<WorkspacePath | null>(null)
  selectionPathRef.current = selectionPath

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

  const pendingExternalRefreshRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      const active = activePathRef.current
      const last = lastLoadedRef.current
      const isDirty = !!(active && last?.path === active && last.text !== activeTextRef.current)
      const changedPath = typeof detail?.path === 'string' && detail.path ? detail.path : null
      if (isDirty && (!changedPath || changedPath === active)) return

      if (pendingExternalRefreshRef.current != null) {
        try {
          window.clearTimeout(pendingExternalRefreshRef.current)
        } catch {
          void 0
        }
      }
      pendingExternalRefreshRef.current = window.setTimeout(() => {
        pendingExternalRefreshRef.current = null
        void refresh()
      }, 180)
    })
    return () => {
      if (pendingExternalRefreshRef.current != null) {
        try {
          window.clearTimeout(pendingExternalRefreshRef.current)
        } catch {
          void 0
        }
        pendingExternalRefreshRef.current = null
      }
      unsubscribe()
    }
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
    if (!highlightedLineRange) return
    const id = window.setTimeout(() => setHighlightedLineRange(null), 1500)
    return () => window.clearTimeout(id)
  }, [highlightedLineRange])

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

  React.useEffect(() => {
    if (!selectionPathRef.current && activePath) {
      setSelectionPath(activePath)
    }
  }, [activePath])

  React.useEffect(() => {
    if (!selectionPath) return
    if (loading) return
    if (entries.some(e => e.path === selectionPath)) return
    if (activePath && entries.some(e => e.path === activePath)) {
      setSelectionPath(activePath)
      return
    }
    setSelectionPath(null)
  }, [activePath, entries, loading, selectionPath])

  const activeEntry = React.useMemo(() => {
    if (!activePath) return null
    return entries.find(e => e.path === activePath) || null
  }, [activePath, entries])

  const selectionEntry = React.useMemo(() => {
    const path = selectionPath
    if (!path) return null
    return entries.find(e => e.path === path) || null
  }, [entries, selectionPath])

  const activeEntryKind = activeEntry ? activeEntry.kind : null
  const activeEntryIsFile = activeEntry?.kind === 'file'
  const activeEntryText = activeEntry && activeEntry.kind === 'file' ? activeEntry.text : undefined
  const activeDocumentKey = React.useMemo(() => {
    if (!activePath) return ''
    if (activeEntry && activeEntry.kind !== 'file') return ''
    return workspaceDocumentKey(activePath)
  }, [activeEntry, activePath])

  React.useEffect(() => {
    const path = activePath
    if (!path) return

    const prev = prevCollapsedRef.current
    if (prev !== effectiveBottomPanelCollapsed) {
      prevCollapsedRef.current = effectiveBottomPanelCollapsed
      if (effectiveBottomPanelCollapsed) {
        collapsedSnapshotRef.current = { path, text: activeText }
        return
      }

      const snap = collapsedSnapshotRef.current
      const candidate =
        snap && snap.path === path && String(snap.text || '').trim()
          ? snap.text
          : (() => {
              const last = lastLoadedRef.current
              if (!last || last.path !== path) return ''
              return last.text
            })()

      if (String(activeText || '').trim()) return
      if (!String(candidate || '').trim()) return
      setActiveText(candidate)
      if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, candidate)
      return
    }

    if (!effectiveBottomPanelCollapsed) return
    if (String(activeText || '').trim()) {
      collapsedSnapshotRef.current = { path, text: activeText }
      return
    }
    const snap = collapsedSnapshotRef.current
    if (!snap || snap.path !== path) return
    if (!String(snap.text || '').trim()) return
    setActiveText(snap.text)
    if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, snap.text)
  }, [
    activeDocumentKey,
    activePath,
    activeText,
    effectiveBottomPanelCollapsed,
    setMarkdownDocument,
  ])

  React.useEffect(() => {
    if (effectiveBottomPanelCollapsed) return
    const path = activePath
    if (!path) return
    if (String(activeText || '').trim()) return

    const last = lastLoadedRef.current
    if (last && last.path === path && String(last.text || '').trim()) {
      setActiveText(last.text)
      if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, last.text)
      return
    }

    void (async () => {
      try {
        const fs = await getFs()
        const text = await fs.readFileText(path)
        const next = typeof text === 'string' ? text : ''
        if (!next.trim()) return
        lastLoadedRef.current = { path, text: next }
        setActiveText(next)
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, next)
      } catch {
        void 0
      }
    })()
  }, [activeDocumentKey, activePath, activeText, effectiveBottomPanelCollapsed, getFs, setMarkdownDocument])

  const createParentPath = React.useMemo<WorkspacePath>(() => {
    if (!selectionEntry) return WORKSPACE_ROOT_PATH
    if (selectionEntry.kind === 'folder') return selectionEntry.path
    if (selectionEntry.parentPath) return selectionEntry.parentPath
    return WORKSPACE_ROOT_PATH
  }, [selectionEntry])

  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      setActivePath(normalized)
    },
    [setActivePath],
  )

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    setSelectionPath(normalizeWorkspacePath(path))
  }, [])

  const isEditing = layoutMode === 'editor' || layoutMode === 'split'
  const isMarkdown = isMarkdownPath(activePath)

  React.useEffect(() => {
    if (!entries.length) return
    if (loading) return

    if (activePath && entries.some(e => e.path === activePath)) return

    const recent = lastRequestedActivePathRef.current
    const storeRecent = lastSetActivePath
    const isRecentlyRequested = (req: { path: WorkspacePath; atMs: number } | null) =>
      !!(activePath && req?.path === activePath && Date.now() - req.atMs < 2000)
    if (isRecentlyRequested(recent) || isRecentlyRequested(storeRecent)) return

    const firstFile = entries.find(e => e.kind === 'file')
    if (!firstFile) return
    if (!activePath) {
      setActivePathSafe(firstFile.path)
      return
    }
    setActivePathSafe(firstFile.path)
  }, [activePath, entries, lastSetActivePath, loading, setActivePathSafe])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (!activeEntry) return
    if (activeEntry.kind !== 'folder') return
    if (activePathRef.current !== path) return
    setActiveText('')
    setHighlightedLineRange(null)
    setStatusLabel('')
  }, [activeEntry, activePath, setMarkdownDocument, setMarkdownDocumentSourceUrl])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return

    const scheduledFor = path

    const lastLoaded = lastLoadedRef.current
    const isDirty = !!(lastLoaded && lastLoaded.path === path && lastLoaded.text !== activeTextRef.current)
    if (isDirty) return

    const cachedText = typeof activeEntryText === 'string' ? String(activeEntryText ?? '') : null
    const source = sourcesByPath[path]
    const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    setMarkdownDocumentSourceUrl(sourceUrl ? sourceUrl : null)

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
        if (text == null) {
          setStatusLabel('Load failed: Missing file contents')
          return
        }
        const next = String(text)
        lastLoadedRef.current = { path, text: next }
        setActiveText(next)
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = next.length <= maxInline ? next : undefined
        setEntries(prev => {
          const idx = prev.findIndex(e => e.path === path)
          if (idx >= 0) {
            const current = prev[idx]
            if (current.kind !== 'file') return prev
            if (current.text === inlineText) return prev
            const nextEntries = prev.slice()
            nextEntries[idx] = { ...current, text: inlineText }
            return nextEntries
          }
          const normalized = normalizeWorkspacePath(path)
          const parts = normalized.replace(/^\/+/, '').split('/').filter(Boolean)
          const name = parts[parts.length - 1] || ''
          const parent = parts.length <= 1 ? WORKSPACE_ROOT_PATH : normalizeWorkspacePath(parts.slice(0, -1).join('/'))
          const nextEntries = prev.slice()
          nextEntries.push({
            path: normalized,
            parentPath: parent,
            kind: 'file',
            name,
            text: inlineText,
            updatedAtMs: Date.now(),
          } satisfies WorkspaceEntry)
          nextEntries.sort((a, b) => a.path.localeCompare(b.path))
          return nextEntries
        })
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
    activeEntryKind,
    activeEntryIsFile,
    activeEntryText,
    activePath,
    getFs,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    setStatusWithAutoClear,
    setStatusLabel,
    setActiveText,
    setEntries,
    sourcesByPath,
  ])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return
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
    activeEntryKind,
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
    const el = editorRef.current
    if (!el) return
    const line = Math.max(1, Math.floor(requestedRevealLine))
    const text = String(activeTextRef.current || '')
    let offset = 0
    let currentLine = 1
    while (currentLine < line && offset < text.length) {
      const nextNewline = text.indexOf('\n', offset)
      if (nextNewline < 0) {
        offset = text.length
        break
      }
      offset = nextNewline + 1
      currentLine += 1
    }
    try {
      el.focus()
      el.setSelectionRange(offset, offset)
      const computed = window.getComputedStyle(el)
      const lineHeightRaw = computed.lineHeight
      const lineHeight = Number.isFinite(Number.parseFloat(lineHeightRaw)) ? Number.parseFloat(lineHeightRaw) : 18
      el.scrollTop = Math.max(0, (line - 1) * Math.max(10, Math.min(40, lineHeight)))
    } catch {
      void 0
    }
    requestRevealLine(null)
  }, [requestRevealLine, requestedRevealLine])

  const revealLineInEditor = React.useCallback(
    (line: number, endLine?: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const start = Math.floor(line)
      const end = Number.isFinite(endLine) && (endLine as number) > 0 ? Math.max(start, Math.floor(endLine as number)) : start
      setHighlightedLineRange({ start, end })
      if (layoutMode !== 'split' && layoutMode !== 'editor') {
        setLayoutMode('split')
      }
      requestRevealLine(start)
    },
    [layoutMode, requestRevealLine, setLayoutMode],
  )

  useCanvasMarkdownSync({
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    layoutMode,
    setLayoutMode,
    revealLineInEditor,
    setStatusLabel,
  })

  const showInViewer = React.useCallback(
    (line: number) => {
      setLayoutMode('viewer')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const showInPresentation = React.useCallback(
    (line: number) => {
      setLayoutMode('presentation')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const showInSlidesGallery = React.useCallback(
    (line: number) => {
      setLayoutMode('slides-gallery')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const graphData = useGraphStore(s => s.graphData) as GraphData | null
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)

  const matchesActiveDoc = React.useCallback(
    (documentPath: unknown) => {
      return matchesMarkdownDocumentPath(activeDocumentKey, documentPath)
    },
    [activeDocumentKey],
  )

  const lastCaretLineRef = React.useRef<number | null>(null)
  const onEditorCaretLine = React.useCallback(
    (line: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const v = Math.floor(line)
      if (lastCaretLineRef.current === v) return
      lastCaretLineRef.current = v
      setHighlightedLineRange({ start: v, end: v })
      if (!graphData) return

      const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
      for (const n of nodes) {
        const loc = getDocumentLocationFromMetadata(n?.metadata)
        if (!loc) continue
        if (!matchesActiveDoc(loc.documentPath)) continue
        const start = Math.max(1, Math.floor(loc.lineStart))
        const end = Math.max(start, Math.floor(loc.lineEnd || loc.lineStart))
        if (v < start || v > end) continue
        const id = String(n.id || '')
        if (!id) continue
        if (selectedNodeId === id) return
        setSelectionSource('editor')
        selectNode(id)
        return
      }

      const edges = Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : []
      for (const e of edges) {
        const loc = getDocumentLocationFromMetadata(e?.metadata)
        if (!loc) continue
        if (!matchesActiveDoc(loc.documentPath)) continue
        const start = Math.max(1, Math.floor(loc.lineStart))
        const end = Math.max(start, Math.floor(loc.lineEnd || loc.lineStart))
        if (v < start || v > end) continue
        const id = String(e.id || '')
        if (!id) continue
        if (selectedEdgeId === id) return
        setSelectionSource('editor')
        selectEdge(id)
        return
      }
    },
    [
      graphData,
      matchesActiveDoc,
      selectEdge,
      selectNode,
      selectedEdgeId,
      selectedNodeId,
      setSelectionSource,
    ],
  )

  const tocTokens = React.useMemo(() => {
    try {
      return lexMarkdown(outlineText).tokens
    } catch {
      return []
    }
  }, [outlineText])

  const onTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      try {
        const tokens = lexMarkdown(activeText).tokens
        const next = reorderMarkdownHeadings(activeText, tokens, parentId, fromIndex, toIndex)
        if (next === activeText) return
        setActiveText(next)
      } catch {
        void 0
      }
    },
    [activeText, setActiveText],
  )
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
      setSelectionPathSafe(path)
    },
    [setActivePathSafe, setSelectionPathSafe],
  )

  const onSelectFolder = React.useCallback(
    (path: WorkspacePath) => {
      setSelectionPathSafe(path)
    },
    [setSelectionPathSafe],
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
      const blocks = (() => {
        const text = String(activeText || '')
        if (!text.includes('```')) return []
        return extractFencedCodeBlocks(text)
          .filter(b => b.lang === 'geojson' || b.lang === 'json')
          .slice(0, 20)
      })()
      if (blocks.length > 0) {
        await Promise.all(
          blocks.map(b =>
            geoDatasetIntegration.registerGeoJsonFeatureCollection?.({
              sourceDocumentPath: name,
              codeBlock: {
                lang: b.lang === 'geojson' ? 'geojson' : 'json',
                text: b.content,
                startLine: b.startLine,
                endLine: b.endLine,
              },
            }),
          ),
        )
      }
      setStatusLabel(ok ? 'Applied' : 'Skipped')
    } catch (e) {
      setStatusLabel(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [activeDocumentKey, activeText, applyMarkdownDocumentToGraph, geoDatasetIntegration])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const el = editorRef.current
      if (!el) return
      const startOffset = typeof el.selectionStart === 'number' ? el.selectionStart : activeText.length
      const endOffset = typeof el.selectionEnd === 'number' ? el.selectionEnd : activeText.length
      const selection = { startOffset, endOffset }
      const { nextText, nextSelection } = applyMarkdownFormatAction({ text: activeText, selection, action })
      setActiveText(nextText)
      const focusAndSelect = () => {
        const h = editorRef.current
        if (!h) return
        try {
          h.focus()
          h.setSelectionRange(nextSelection.startOffset, nextSelection.endOffset)
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
    openedPath: activePath,
    selectionPath,
    selectionEntryKind: selectionEntry?.kind ?? null,
    activeDocumentKey,
    setActiveText,
    setEntries,
    lastLoadedRef,
    setExpandedPaths,
    setActivePathSafe,
    setSelectionPathSafe,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    applyMarkdownDocumentToGraph,
  })

  const canRefreshActiveFromSource = React.useMemo(() => {
    if (!selectionPath || selectionEntry?.kind !== 'file') return false
    const src = sourcesByPath ? sourcesByPath[selectionPath] : null
    return !!(src && src.kind === 'url' && String((src as { url?: unknown }).url || '').trim())
  }, [selectionEntry, selectionPath, sourcesByPath])

  const openBacklink = React.useCallback(
    (args: { path: WorkspacePath; line: number }) => {
      setActivePathSafe(args.path)
      setSelectionPathSafe(args.path)
      revealLineInEditor(args.line)
    },
    [revealLineInEditor, setActivePathSafe, setSelectionPathSafe],
  )

  const editorUri = activePath ? `inmemory://workspace/${encodeURIComponent(workspaceDocumentKey(activePath) || 'document')}` : 'inmemory://model/empty'
  const editorLanguage = activePath ? languageForPath(activePath) : 'markdown'

  const showGraphTable = workspaceViewMode === 'editor' && editorWorkspaceSection === 'graphTable'

  return (
    <section
      ref={workspaceRootRef}
      className={`flex-1 w-full h-full min-h-0 flex overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Markdown Workspace"
    >
      <MarkdownWorkspaceExplorer
        uiPanelTextFontClass={uiPanelTextFontClass}
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
        activePath={selectionPath || activePath}
        onSelectFile={onSelectFile}
        onSelectFolder={onSelectFolder}
        search={search}
        setSearch={setSearch}
        sourceFilesCollapsed={sourceFilesCollapsed}
        setSourceFilesCollapsed={setSourceFilesCollapsed}
        tocCollapsed={tocCollapsed}
        setTocCollapsed={setTocCollapsed}
        backlinksCollapsed={backlinksCollapsed}
        setBacklinksCollapsed={setBacklinksCollapsed}
        tocTokens={tocTokens}
        backlinks={backlinks}
        onRevealLine={revealLineInEditor}
        onOpenBacklink={openBacklink}
        onTocReorder={onTocReorder}
        onCreateNewFile={() => void fileActions.createNewFile({ parentPath: createParentPath })}
        onCreateNewFolder={() => void fileActions.createNewFolder({ parentPath: createParentPath })}
        onRefresh={() => void refresh()}
        statusLabel={statusLabel}
        activeEntryName={selectionEntry?.name || ''}
        activeEntryKind={selectionEntry?.kind || ''}
        canClearActiveSelection={fileActions.canClearActiveSelection}
        onClearActiveSelection={fileActions.onClearActiveSelection}
        canRefreshActiveFromSource={canRefreshActiveFromSource}
        onRefreshActiveFromSource={() => {
          if (!selectionPath || selectionEntry?.kind !== 'file') return
          void fileActions.refreshFileFromSource(selectionPath)
        }}
        canDeleteActive={fileActions.canDeleteActive}
        onDeleteActive={fileActions.onDeleteActive}
      />

      <VerticalResizeSeparatorHr ref={resizeHandleRef} ariaLabel="Resize explorer" />

      {showGraphTable ? (
        <React.Suspense fallback={null}>
          <GraphTableWorkspaceLazy />
        </React.Suspense>
      ) : (
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
          activeDocumentKey={activeDocumentKey}
          highlightedLineRange={highlightedLineRange}
          revealLineInEditor={revealLineInEditor}
          showInViewer={showInViewer}
          showInPresentation={showInPresentation}
          showInSlidesGallery={showInSlidesGallery}
          editorUri={editorUri}
          editorLanguage={editorLanguage}
          editorRef={editorRef}
          onEditorCaretLine={onEditorCaretLine}
        />
      )}
    </section>
  )
}
