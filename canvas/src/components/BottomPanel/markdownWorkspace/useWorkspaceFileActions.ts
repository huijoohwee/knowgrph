import React from 'react'
import type { WorkspaceEntry, WorkspacePath, WorkspaceFs } from '@/features/workspace-fs/types'
import {
  WORKSPACE_ROOT_PATH,
  ancestorPathsForWorkspacePath,
  normalizeWorkspacePath,
  workspaceDocumentKey,
} from '@/features/workspace-fs/path'
import {
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  importWorkspaceUrl,
  fetchWorkspaceUrlContent,
} from './workspaceImport'
import {
  bulkSetWorkspaceEntrySources,
  loadWorkspaceSourceIndex,
  removeWorkspaceEntrySourcesForPrefix,
  setWorkspaceEntrySource,
} from '@/features/workspace-fs/sourceIndex'
import { runWorkspaceFsChangedBatch } from '@/features/workspace-fs/workspaceFsEvents'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'

export function shouldForceDocumentSemanticModeForImport(nameForParse: string): boolean {
  const lower = String(nameForParse || '').trim().toLowerCase()
  if (!lower) return false
  if (isMarkdownLikeFileName(lower)) return false
  return lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.csv') || lower.endsWith('.geojson') || lower.endsWith('.yaml') || lower.endsWith('.yml')
}

export function useWorkspaceFileActions(args: {
  getFs: () => Promise<WorkspaceFs>
  refresh: () => Promise<void>
  setStatusLabel: (next: string) => void

  openedPath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  selectionEntryKind: WorkspaceEntry['kind'] | null
  activeDocumentKey: string
  setActiveText: (next: string) => void
  setEntries: React.Dispatch<React.SetStateAction<WorkspaceEntry[]>>
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>

  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  setActivePathSafe: (path: WorkspacePath) => void
  setSelectionPathSafe: (path: WorkspacePath) => void

  setMarkdownDocument: (name: string | null, text: string | null) => void
  setMarkdownDocumentSourceUrl: (url: string | null) => void
  applyMarkdownDocumentToGraph: (name: string, text: string, opts?: { force?: boolean }) => Promise<boolean>
}) {
  const {
    getFs,
    refresh,
    setStatusLabel,
    openedPath,
    selectionPath,
    selectionEntryKind,
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
  } = args

  const importJobRef = React.useRef(0)

  const applyImportedTextToGraph = React.useCallback(
    async (args: { nameForParse: string; text: string }) => {
      const storeBefore = useGraphStore.getState()
      const okMarkdown = await applyMarkdownDocumentToGraph(args.nameForParse, args.text, { force: true })
      if (!okMarkdown) {
        const { loadGraphDataFromTextViaParser } =
          (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
        await loadGraphDataFromTextViaParser(args.nameForParse, args.text, { applyToStore: true })
      }

      const store = useGraphStore.getState()
      const graphData = store.graphData
      const hasAnyGraph = !!(
        graphData && (((graphData.nodes || []).length > 0) || ((graphData.edges || []).length > 0))
      )
      if (!hasAnyGraph) return

      if (shouldForceDocumentSemanticModeForImport(args.nameForParse)) {
        store.setDocumentSemanticMode('document')
      }

      const meta = (graphData?.metadata || {}) as Record<string, unknown>
      const hasQuickEditorRegistry = Array.isArray(meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY])
        ? (meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY] as unknown[]).length > 0
        : false

      if (hasQuickEditorRegistry) {
        const schema = store.schema
        if (schema) {
          const { enableHandlesForAllInputsInSchema } =
            (await import('@/lib/flowEditor/flowEditorActions')) as typeof import('@/lib/flowEditor/flowEditorActions')
          const res = enableHandlesForAllInputsInSchema(schema)
          if (res.changed) store.setSchema(res.schema)
        }
        store.setCanvasRenderMode('2d')
        store.setCanvas2dRenderer('flowEditor')
        store.setWorkspaceViewMode('canvas')
        return
      }

      if (storeBefore.workspaceViewMode !== 'table') {
        store.setWorkspaceViewMode('table')
      }
    },
    [applyMarkdownDocumentToGraph],
  )

  const focusAfterImport = React.useCallback(
    async (createdPath: WorkspacePath, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => {
      if (opts?.jobId != null && importJobRef.current !== opts.jobId) return
      setActivePathSafe(createdPath)
      setSelectionPathSafe(createdPath)
      setExpandedPaths(prev => {
        const next = new Set(prev)
        for (const ancestor of ancestorPathsForWorkspacePath(createdPath)) next.add(ancestor)
        return next
      })
      if (opts?.sourceUrl) setMarkdownDocumentSourceUrl(opts.sourceUrl)
      if (opts?.applyToGraph) {
        try {
          const fs = await getFs()
          const text = await fs.readFileText(createdPath)
          if (opts?.jobId != null && importJobRef.current !== opts.jobId) return
          const docKey = workspaceDocumentKey(createdPath)
          const content = String(text || '')
          lastLoadedRef.current = { path: createdPath, text: content }
          setActiveText(content)
          if (docKey && content.trim()) {
            setMarkdownDocument(docKey, content)
            await applyImportedTextToGraph({ nameForParse: docKey, text: content })
          }
        } catch (e) {
          setStatusLabel(`Apply failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        }
      }
    },
    [applyImportedTextToGraph, getFs, lastLoadedRef, setActivePathSafe, setActiveText, setExpandedPaths, setMarkdownDocument, setMarkdownDocumentSourceUrl, setSelectionPathSafe, setStatusLabel],
  )

  const createNewFile = React.useCallback(async (opts?: { parentPath?: WorkspacePath }) => {
    setStatusLabel('Creating…')
    try {
      const fs = await getFs()
      const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
      const path = await fs.createFile({ parentPath, name: 'note.md', text: '' })
      setWorkspaceEntrySource(path, { kind: 'local', originalName: null })
      await refresh()
      setActivePathSafe(path)
      setSelectionPathSafe(path)
      setStatusLabel('Created')
    } catch (e) {
      setStatusLabel(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [getFs, refresh, setActivePathSafe, setSelectionPathSafe, setStatusLabel])

  const createNewFolder = React.useCallback(async (opts?: { parentPath?: WorkspacePath }) => {
    setStatusLabel('Creating…')
    try {
      const fs = await getFs()
      const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
      const path = await fs.createFolder({ parentPath, name: 'folder' })
      setExpandedPaths(prev => new Set(prev).add(path))
      await refresh()
      setSelectionPathSafe(path)
      setStatusLabel('Created')
    } catch (e) {
      setStatusLabel(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [getFs, refresh, setExpandedPaths, setSelectionPathSafe, setStatusLabel])

  const handleImportLocalFiles = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      setStatusLabel('Importing…')
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFiles({ fs, files: snapshot, parentPath: WORKSPACE_ROOT_PATH }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()
        const lastCreated = res.createdPaths[res.createdPaths.length - 1] || null
        if (lastCreated) await focusAfterImport(lastCreated, { applyToGraph: true, jobId })
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        setStatusLabel(`Imported ${imported}${suffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusLabel(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, refresh, setStatusLabel],
  )

  const handleImportLocalFolder = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      setStatusLabel('Importing folder…')
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() => importWorkspaceLocalFolder({ fs, files: snapshot }))
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()
        const lastCreated = res.createdPaths[res.createdPaths.length - 1] || null
        if (lastCreated) await focusAfterImport(lastCreated, { applyToGraph: true, jobId })
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        setStatusLabel(`Imported ${imported}${suffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusLabel(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, refresh, setStatusLabel],
  )

  const handleImportUrl = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      setStatusLabel('Importing URL…')
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceUrl({
            fs,
            urlRaw: url,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              if (importJobRef.current !== jobId) return
              if (p.phase === 'listing') {
                setStatusLabel(p.label ? `${p.label}…` : 'Listing…')
                return
              }
              if (p.total && p.total > 0) {
                setStatusLabel(`${p.phase === 'fetching' ? 'Fetching' : 'Writing'} ${p.current}/${p.total}…`)
                return
              }
              setStatusLabel(`${p.phase === 'fetching' ? 'Fetching' : 'Writing'}…`)
            },
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()
        const createdPath = res.createdPaths.find(p => typeof p === 'string' && p.trim()) || null
        const source = createdPath ? res.sources.find(s => s.path === createdPath)?.source : res.sources[0]?.source
        const sourceUrl = source && source.kind === 'url' ? source.url : null
        if (createdPath) await focusAfterImport(createdPath, { sourceUrl, applyToGraph: true, jobId })
        setStatusLabel(res.createdPaths.length > 1 ? `Imported ${res.createdPaths.length}` : 'Imported URL')
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusLabel(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, refresh, setStatusLabel],
  )

  const refreshFileFromSource = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      const index = loadWorkspaceSourceIndex()
      const src = index[normalized]
      if (!src || src.kind !== 'url' || !String(src.url || '').trim()) {
        setStatusLabel('No URL source')
        return
      }
      setStatusLabel('Refreshing…')
      try {
        const fs = await getFs()
        const fetched = await fetchWorkspaceUrlContent(src.url)
        await fs.writeFileText(normalized, fetched.text)
        const inlineText = fetched.text.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? fetched.text : undefined
        setEntries(prev => prev.map(e => (e.path === normalized ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        if (openedPath === normalized) {
          lastLoadedRef.current = { path: normalized, text: fetched.text }
          setActiveText(fetched.text)
          if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, fetched.text)
          setMarkdownDocumentSourceUrl(fetched.normalizedUrl)
          if (activeDocumentKey && String(fetched.text || '').trim()) {
            await applyImportedTextToGraph({ nameForParse: activeDocumentKey, text: fetched.text })
          }
        }
        setStatusLabel('Refreshed')
      } catch (e) {
        setStatusLabel(`Refresh failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, openedPath, applyImportedTextToGraph, getFs, lastLoadedRef, setActiveText, setEntries, setMarkdownDocument, setMarkdownDocumentSourceUrl, setStatusLabel],
  )

  const deleteEntry = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      setStatusLabel('Deleting…')
      try {
        const fs = await getFs()
        await fs.deleteEntry(normalized)
        removeWorkspaceEntrySourcesForPrefix(normalized)
        await refresh()
        setStatusLabel('Deleted')
      } catch (e) {
        setStatusLabel(`Delete failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, setStatusLabel],
  )

  const clearFile = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      setStatusLabel('Clearing…')
      try {
        const fs = await getFs()
        await fs.writeFileText(normalized, '')
        lastLoadedRef.current = { path: normalized, text: '' }
        setEntries(prev => prev.map(e => (e.path === normalized ? { ...e, text: '', updatedAtMs: Date.now() } : e)))
        if (openedPath === normalized) {
          setActiveText('')
          if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, '')
        }
        setStatusLabel('Cleared')
      } catch (e) {
        setStatusLabel(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, openedPath, getFs, lastLoadedRef, setActiveText, setEntries, setMarkdownDocument, setStatusLabel],
  )

  const clearFolder = React.useCallback(
    async (folderPath: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(folderPath)
      if (!normalized || normalized === WORKSPACE_ROOT_PATH) return
      const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`
      setStatusLabel('Clearing…')
      try {
        const fs = await getFs()
        const list = await fs.listEntries()
        const targets = list
          .filter(e => e.kind === 'file')
          .map(e => normalizeWorkspacePath(e.path))
          .filter(p => p.startsWith(prefix))
        const targetSet = new Set(targets)

        for (const p of targets) {
          await fs.writeFileText(p, '')
        }

        const normalizedActivePath = openedPath ? normalizeWorkspacePath(openedPath) : null
        const shouldClearActive = !!(normalizedActivePath && targetSet.has(normalizedActivePath))
        if (shouldClearActive) {
          lastLoadedRef.current = { path: normalizedActivePath as WorkspacePath, text: '' }
          setActiveText('')
          if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, '')
        } else {
          const last = lastLoadedRef.current
          if (last && targetSet.has(last.path)) {
            lastLoadedRef.current = { path: last.path, text: '' }
          }
        }

        if (targets.length > 0) {
          setEntries(prev => prev.map(e => (targetSet.has(e.path) ? { ...e, text: '', updatedAtMs: Date.now() } : e)))
        }
        setStatusLabel(targets.length > 0 ? `Cleared ${targets.length} files` : 'Cleared')
      } catch (e) {
        setStatusLabel(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, openedPath, getFs, lastLoadedRef, setActiveText, setEntries, setMarkdownDocument, setStatusLabel],
  )

  const canClearActiveSelection = !!(
    selectionPath &&
    (selectionEntryKind === 'file' || (selectionEntryKind === 'folder' && selectionPath !== WORKSPACE_ROOT_PATH))
  )
  const canDeleteActive = !!selectionPath && selectionPath !== WORKSPACE_ROOT_PATH

  const clearActiveSelection = React.useCallback(() => {
    if (!selectionPath) return
    if (selectionEntryKind === 'file') {
      void clearFile(selectionPath)
      return
    }
    if (selectionEntryKind === 'folder') {
      void clearFolder(selectionPath)
    }
  }, [clearFile, clearFolder, selectionEntryKind, selectionPath])

  const deleteActive = React.useCallback(() => {
    if (!selectionPath) return
    if (selectionPath === WORKSPACE_ROOT_PATH) return
    void deleteEntry(selectionPath)
  }, [deleteEntry, selectionPath])

  const onDeleteEntry = React.useCallback((path: WorkspacePath) => {
    void deleteEntry(path)
  }, [deleteEntry])

  const onClearFile = React.useCallback((path: WorkspacePath) => {
    void clearFile(path)
  }, [clearFile])

  const onDeleteActive = React.useCallback(() => {
    deleteActive()
  }, [deleteActive])

  const onClearActiveSelection = React.useCallback(() => {
    clearActiveSelection()
  }, [clearActiveSelection])

  return {
    createNewFile,
    createNewFolder,
    handleImportLocalFiles,
    handleImportLocalFolder,
    handleImportUrl,
    onDeleteEntry,
    onClearFile,
    refreshFileFromSource,
    canClearActiveSelection,
    canDeleteActive,
    onClearActiveSelection,
    onDeleteActive,
  }
}
