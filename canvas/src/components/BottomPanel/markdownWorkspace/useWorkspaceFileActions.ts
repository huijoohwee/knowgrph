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
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY, UI_COPY, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { hashStringToHex } from '@/lib/hash/stringHash'
import type { MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'

export function shouldForceDocumentSemanticModeForImport(nameForParse: string): boolean {
  const lower = String(nameForParse || '').trim().toLowerCase()
  if (!lower) return false
  if (isMarkdownLikeFileName(lower)) return false
  return lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.csv') || lower.endsWith('.geojson') || lower.endsWith('.yaml') || lower.endsWith('.yml')
}

export function useWorkspaceFileActions(args: {
  getFs: () => Promise<WorkspaceFs>
  refresh: () => Promise<void>
  setStatusLabel: (next: MarkdownWorkspaceStatus) => void

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

  const setStatusInfo = React.useCallback(
    (label: string) => {
      const msg = String(label || '').trim()
      if (!msg) return
      setStatusLabel({ kind: 'info', label: msg })
    },
    [setStatusLabel],
  )

  const setStatusError = React.useCallback(
    (label: string) => {
      const msg = String(label || '').trim()
      if (!msg) return
      setStatusLabel({ kind: 'error', label: msg })
    },
    [setStatusLabel],
  )

  const setStatusProgress = React.useCallback(
    (
      label: string,
      current?: number | null,
      total?: number | null,
      bytesCurrent?: number | null,
      bytesTotal?: number | null,
    ) => {
      const msg = String(label || '').trim()
      if (!msg) return
      setStatusLabel({
        kind: 'progress',
        label: msg,
        current: typeof current === 'number' ? current : null,
        total: typeof total === 'number' ? total : null,
        bytesCurrent: typeof bytesCurrent === 'number' ? bytesCurrent : null,
        bytesTotal: typeof bytesTotal === 'number' ? bytesTotal : null,
      })
    },
    [setStatusLabel],
  )

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
      const baselineLocked = store.documentStructureBaselineLock === true
      const graphData = store.graphData
      const hasAnyGraph = !!(
        graphData && (((graphData.nodes || []).length > 0) || ((graphData.edges || []).length > 0))
      )
      if (!hasAnyGraph) return

      if (!baselineLocked && shouldForceDocumentSemanticModeForImport(args.nameForParse)) {
        store.setDocumentSemanticMode('document')
      }

      const meta = (graphData?.metadata || {}) as Record<string, unknown>
      const hasQuickEditorRegistry = Array.isArray(meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY])
        ? (meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY] as unknown[]).length > 0
        : false

      if (hasQuickEditorRegistry) {
        if (baselineLocked) {
          store.upsertUiToast({
            id: 'baseline-locked',
            kind: 'warning',
            message: UI_COPY.baselineLockedToast,
            ttlMs: 6000,
          })
          return
        }
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

      if (!baselineLocked && storeBefore.workspaceViewMode !== 'table') {
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
          setStatusError(`Apply failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        }
      }
    },
    [applyImportedTextToGraph, getFs, lastLoadedRef, setActivePathSafe, setActiveText, setExpandedPaths, setMarkdownDocument, setMarkdownDocumentSourceUrl, setSelectionPathSafe, setStatusLabel],
  )

  const createNewFile = React.useCallback(async (opts?: { parentPath?: WorkspacePath }) => {
    setStatusProgress('Creating')
    try {
      const fs = await getFs()
      const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
      const path = await fs.createFile({ parentPath, name: 'note.md', text: '' })
      setWorkspaceEntrySource(path, { kind: 'local', originalName: null })
      await refresh()
      setActivePathSafe(path)
      setSelectionPathSafe(path)
      setStatusInfo('Created')
    } catch (e) {
      setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [getFs, refresh, setActivePathSafe, setSelectionPathSafe, setStatusLabel])

  const createNewFolder = React.useCallback(async (opts?: { parentPath?: WorkspacePath }) => {
    setStatusProgress('Creating')
    try {
      const fs = await getFs()
      const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
      const path = await fs.createFolder({ parentPath, name: 'folder' })
      setExpandedPaths(prev => new Set(prev).add(path))
      await refresh()
      setSelectionPathSafe(path)
      setStatusInfo('Created')
    } catch (e) {
      setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [getFs, refresh, setExpandedPaths, setSelectionPathSafe, setStatusLabel])

  const handleImportLocalFiles = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      setStatusProgress('Importing', 0, snapshot.length)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFiles({
            fs,
            files: snapshot,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              if (importJobRef.current !== jobId) return
              setStatusProgress(p.label || 'Importing', p.current, p.total, p.bytesCurrent, p.bytesTotal)
            },
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        const firstFailure = res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        setStatusInfo(`Imported ${imported}${suffix}${failureSuffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, refresh, setStatusLabel],
  )

  const handleImportLocalFolder = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      setStatusLabel(null)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFolder({
            fs,
            files: snapshot,
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        const firstFailure = res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        setStatusInfo(`Imported folder: ${imported}${suffix}${failureSuffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, setStatusLabel],
  )

  const handleImportUrl = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      setStatusProgress('Importing URL')
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
                setStatusProgress(p.label ? String(p.label) : 'Listing')
                return
              }
              if (p.total && p.total > 0) {
                setStatusProgress(p.phase === 'fetching' ? 'Fetching' : 'Writing', p.current, p.total)
                return
              }
              setStatusProgress(p.phase === 'fetching' ? 'Fetching' : 'Writing')
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
        setStatusInfo(res.createdPaths.length > 1 ? `Imported ${res.createdPaths.length}` : 'Imported URL')
      } catch (e) {
        if (importJobRef.current !== jobId) return
        setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, refresh, setStatusLabel],
  )

  const handleImportWebsite = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      setStatusProgress('Importing website')
      try {
        const store = useGraphStore.getState()
        const outputDirRel = String(store.websiteImportOutputDirRel || '').trim()
        const discoverSitemap = store.websiteImportDiscoverSitemap !== false
        const maxPages = Number.isFinite(store.websiteImportMaxPages) ? Number(store.websiteImportMaxPages) : 50
        const concurrency = Number.isFinite(store.websiteImportConcurrency) ? Number(store.websiteImportConcurrency) : 4
        const includeImages = store.webpageImportIncludeImages ?? true
        const wireframeDetailLevel = store.webpageWireframeDetailLevel
        const defaultView = store.webpageImportView

        const startRes = await fetch(
          `/__website_import/start?outputDirRel=${encodeURIComponent(outputDirRel)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              url,
              options: { discoverSitemap, maxPages, concurrency, includeImages, wireframeDetailLevel },
            }),
          },
        )
        const startJson = (await startRes.json()) as { ok?: unknown; importId?: unknown; error?: unknown }
        if (importJobRef.current !== jobId) return
        if (!startRes.ok || startJson.ok !== true || typeof startJson.importId !== 'string') {
          const err = typeof startJson.error === 'string' && startJson.error.trim() ? startJson.error.trim() : `HTTP ${startRes.status}`
          setStatusError(`Import failed: ${err}`)
          return
        }
        const importId = startJson.importId

        const pollUntilDone = async (): Promise<'done' | 'failed'> => {
          const startedAtMs = Date.now()
          while (true) {
            if (importJobRef.current !== jobId) throw new Error('cancelled')
            const statusRes = await fetch(
              `/__website_import/status?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}`,
              { headers: { Accept: 'application/json' } },
            )
            const statusJson = (await statusRes.json()) as { ok?: unknown; status?: unknown }
            const status = typeof statusJson.status === 'string' ? statusJson.status : ''
            if (status === 'done') return 'done'
            if (status === 'failed') return 'failed'
            if (Date.now() - startedAtMs > 10 * 60_000) return 'failed'
            await new Promise<void>(resolve => setTimeout(resolve, 650))
          }
        }

        const result = await pollUntilDone()
        if (importJobRef.current !== jobId) return
        if (result !== 'done') {
          setStatusError('Import failed')
          return
        }

        const manifestRes = await fetch(
          `/__website_import/manifest?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}`,
          { headers: { Accept: 'application/json' } },
        )
        const manifestJson = (await manifestRes.json()) as { ok?: unknown; manifest?: unknown; error?: unknown }
        if (importJobRef.current !== jobId) return
        if (!manifestRes.ok || manifestJson.ok !== true || !manifestJson.manifest || typeof manifestJson.manifest !== 'object') {
          const err = typeof manifestJson.error === 'string' && manifestJson.error.trim() ? manifestJson.error.trim() : `HTTP ${manifestRes.status}`
          setStatusError(`Import failed: ${err}`)
          return
        }
        const manifest = manifestJson.manifest as { rootUrl?: unknown; nodes?: unknown }
        const rootUrl = typeof manifest.rootUrl === 'string' ? manifest.rootUrl : url
        const nodes = Array.isArray(manifest.nodes) ? (manifest.nodes as Array<Record<string, unknown>>) : []

        const host = (() => {
          try {
            return new URL(rootUrl).host
          } catch {
            return 'website'
          }
        })()

        const safeSegment = (raw: string): string => {
          const s = String(raw || '').trim()
          if (!s) return 'item'
          const cleaned = s
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-.]+/, '')
            .replace(/[-.]+$/, '')
          return cleaned.slice(0, 64) || 'item'
        }

        const ensureFolderPath = async (fs: WorkspaceFs, absPath: string) => {
          const normalized = normalizeWorkspacePath(absPath)
          const segments = normalized.split('/').filter(Boolean)
          let parent = WORKSPACE_ROOT_PATH
          for (const seg of segments) {
            const name = safeSegment(seg)
            const nextPath = normalizeWorkspacePath(`${parent}/${name}`)
            try {
              await fs.createFolder({ parentPath: parent, name })
            } catch {
              void 0
            }
            parent = nextPath
          }
          return parent
        }

        const stubForNode = (nodeUrl: string, nodeId: string) => {
          const v =
            defaultView === 'html' ||
            defaultView === 'json' ||
            defaultView === 'wireframe' ||
            defaultView === 'wireframe-enhanced'
              ? defaultView
              : 'markdown'
          const lines = [
            '---',
            `kgWebpageUrl: "${nodeUrl}"`,
            `kgWebpageView: "${v}"`,
            `kgWebsiteImportId: "${importId}"`,
            `kgWebsiteNodeId: "${nodeId}"`,
          ]
          if (outputDirRel && outputDirRel.trim()) {
            lines.push(`kgWebsiteOutputDirRel: "${outputDirRel.trim()}"`)
          }
          lines.push('---', '')
          return lines.join('\n')
        }

        const fs = await getFs()
        await fs.ensureSeed()

        const created = await runWorkspaceFsChangedBatch(async () => {
          const rootFolder = await ensureFolderPath(fs, `/websites/${safeSegment(host)}/${safeSegment(importId)}`)
          const createdPaths: WorkspacePath[] = []
          const sources: Array<{ path: WorkspacePath; source: { kind: 'url'; url: string; path: string } }> = []

          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i] || {}
            const nodeUrl = typeof node.url === 'string' ? node.url : ''
            const nodeId = typeof node.nodeId === 'string' ? node.nodeId : hashStringToHex(nodeUrl).slice(0, 16)
            const nodeTreePath = typeof node.path === 'string' ? node.path : ''
            const status = typeof node.status === 'string' ? node.status : 'ok'
            if (!nodeUrl || status !== 'ok') continue
            const nodePath = (() => {
              try {
                const raw = nodeTreePath && nodeTreePath.trim() ? nodeTreePath : new URL(nodeUrl).pathname
                const parts = String(raw || '').split('/').filter(Boolean)
                return parts.map(safeSegment)
              } catch {
                return []
              }
            })()
            const leaf = nodePath[nodePath.length - 1] || 'index'
            const folderParts = nodePath.slice(0, Math.max(0, nodePath.length - 1))
            const folderPath = folderParts.length ? await ensureFolderPath(fs, `${rootFolder}/${folderParts.join('/')}`) : rootFolder

            const base = leaf || 'index'
            const nameBase = base.endsWith('.md') ? base.replace(/\.md$/i, '') : base
            const primaryName = `${nameBase}.md`
            const text = stubForNode(nodeUrl, nodeId)

            const tryCreate = async (name: string) => {
              const createdPath = await fs.createFile({ parentPath: folderPath, name, text })
              createdPaths.push(createdPath)
              sources.push({ path: createdPath, source: { kind: 'url', url: nodeUrl, path: `workspace:${createdPath}` } })
              return createdPath
            }

            try {
              await tryCreate(primaryName)
            } catch {
              const alt = `${nameBase}-${hashStringToHex(nodeUrl).slice(0, 6)}.md`
              try {
                await tryCreate(alt)
              } catch {
                void 0
              }
            }
            if ((i + 1) % 10 === 0) {
              setStatusProgress('Writing', i + 1, Math.max(i + 1, nodes.length))
            }
          }
          return { createdPaths, sources }
        })

        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(created.sources)
        await refresh()
        const first = created.createdPaths[0]
        if (first) {
          await focusAfterImport(first, { sourceUrl: null, applyToGraph: false, jobId })
        }
        setStatusInfo(`Imported website: ${host}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        if (/cancelled/i.test(msg)) return
        setStatusError(`Import failed: ${msg}`)
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
        setStatusError('No URL source')
        return
      }
      setStatusProgress('Refreshing')
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
        setStatusInfo('Refreshed')
      } catch (e) {
        setStatusError(`Refresh failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, openedPath, applyImportedTextToGraph, getFs, lastLoadedRef, setActiveText, setEntries, setMarkdownDocument, setMarkdownDocumentSourceUrl, setStatusLabel],
  )

  const deleteEntry = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      setStatusProgress('Deleting')
      try {
        const fs = await getFs()
        await fs.deleteEntry(normalized)
        removeWorkspaceEntrySourcesForPrefix(normalized)
        await refresh()
        setStatusInfo('Deleted')
      } catch (e) {
        setStatusError(`Delete failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, setStatusLabel],
  )

  const clearFile = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      setStatusProgress('Clearing')
      try {
        const fs = await getFs()
        await fs.writeFileText(normalized, '')
        lastLoadedRef.current = { path: normalized, text: '' }
        setEntries(prev => prev.map(e => (e.path === normalized ? { ...e, text: '', updatedAtMs: Date.now() } : e)))
        if (openedPath === normalized) {
          setActiveText('')
          if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, '')
        }
        setStatusInfo('Cleared')
      } catch (e) {
        setStatusError(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, openedPath, getFs, lastLoadedRef, setActiveText, setEntries, setMarkdownDocument, setStatusLabel],
  )

  const clearFolder = React.useCallback(
    async (folderPath: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(folderPath)
      if (!normalized || normalized === WORKSPACE_ROOT_PATH) return
      const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`
      setStatusProgress('Clearing')
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
        setStatusInfo(targets.length > 0 ? `Cleared ${targets.length} files` : 'Cleared')
      } catch (e) {
        setStatusError(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
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
    handleImportWebsite,
    onDeleteEntry,
    onClearFile,
    refreshFileFromSource,
    canClearActiveSelection,
    canDeleteActive,
    onClearActiveSelection,
    onDeleteActive,
  }
}
