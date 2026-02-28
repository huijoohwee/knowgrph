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
import {
  extractYamlFrontmatterBlock,
  isFrontmatterOnlyDoc,
  normalizeWebpageFrontmatterView,
  parseWebpageFrontmatterMeta,
  readYamlFrontmatterValue,
  upsertWebpageFrontmatterMeta,
} from '@/lib/markdown/frontmatter'
import { buildWebsiteSitemapMarkdown } from '@/lib/websites/websiteSitemapMarkdown'
import { safeWebsitePathSegment } from '@/lib/websites/websitePathUtils'
import { fetchWebsiteImportArtifact } from '@/lib/websites/webpageIframeSrcdoc'
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'
import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from './workspaceImport'
import { mapLimit } from '@/lib/async/mapLimit'
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

  const buildWebpageImportStageLabel = React.useCallback((pctRaw: number): string => {
    const pct = Math.max(0, Math.min(100, Math.floor(Number.isFinite(pctRaw) ? pctRaw : 0)))
    if (pct < 20) return 'Fetching webpage HTML'
    if (pct < 60) return 'Processing webpage DOM'
    if (pct < 90) return 'Converting webpage to Markdown'
    return 'Finalizing webpage document'
  }, [])

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
    [
      applyImportedTextToGraph,
      getFs,
      lastLoadedRef,
      setActivePathSafe,
      setActiveText,
      setExpandedPaths,
      setMarkdownDocument,
      setMarkdownDocumentSourceUrl,
      setSelectionPathSafe,
      setStatusError,
    ],
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
  }, [getFs, refresh, setActivePathSafe, setSelectionPathSafe, setStatusError, setStatusInfo, setStatusProgress])

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
  }, [getFs, refresh, setExpandedPaths, setSelectionPathSafe, setStatusError, setStatusInfo, setStatusProgress])

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
    [getFs, refresh, setStatusError, setStatusInfo, setStatusProgress],
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
    [getFs, refresh, setStatusError, setStatusInfo, setStatusLabel],
  )

  const handleImportUrl = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      const toastId = `workspace:import:url:${hashStringToHex(url).slice(0, 10)}`
      setStatusProgress('Importing URL')
      useGraphStore.getState().upsertUiToast({
        id: toastId,
        kind: 'neutral',
        message: `Importing URL: ${url}`,
        ttlMs: null,
        dismissible: false,
        log: false,
      })
      useGraphStore.getState().pushUiLog({ kind: 'neutral', message: `Import URL started: ${url}`, source: 'workspace:importUrl' })
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const maxImportLogRows = 59
        let logCount = 1
        let lastLabel = ''
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceUrl({
            fs,
            urlRaw: url,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              if (importJobRef.current !== jobId) return
              const label = p.label ? String(p.label) : p.phase
              if (label && label !== lastLabel && logCount < maxImportLogRows - 1) {
                lastLabel = label
                logCount += 1
                useGraphStore.getState().pushUiLog({ kind: 'neutral', message: label, source: 'workspace:importUrl' })
              }
              if (p.phase === 'listing') {
                setStatusProgress(p.label ? String(p.label) : 'Listing')
                useGraphStore.getState().upsertUiToast({
                  id: toastId,
                  kind: 'neutral',
                  message: `Importing URL: Listing…`,
                  ttlMs: null,
                  dismissible: false,
                  log: false,
                })
                return
              }
              if (p.phase === 'fetching' && p.total && p.total > 0) {
                const pct = p.current && p.current > 0 ? (p.current / p.total) * 100 : 0
                const stageLabel = buildWebpageImportStageLabel(pct)
                const pctInt = Math.max(0, Math.min(100, Math.floor(pct)))
                setStatusProgress(stageLabel, pctInt, 100)
                useGraphStore.getState().upsertUiToast({
                  id: toastId,
                  kind: 'neutral',
                  message: `Importing URL: ${stageLabel} ${pctInt}%`,
                  ttlMs: null,
                  dismissible: false,
                  log: false,
                })
                return
              }
              if (p.phase === 'fetching') {
                const stageLabel = buildWebpageImportStageLabel(0)
                setStatusProgress(stageLabel)
                useGraphStore.getState().upsertUiToast({
                  id: toastId,
                  kind: 'neutral',
                  message: `Importing URL: ${stageLabel}…`,
                  ttlMs: null,
                  dismissible: false,
                  log: false,
                })
                return
              }
              if (p.total && p.total > 0) {
                const label = 'Writing'
                if (p.current && p.current > 0) setStatusProgress(label, p.current, p.total)
                else setStatusProgress(label)
                useGraphStore.getState().upsertUiToast({
                  id: toastId,
                  kind: 'neutral',
                  message:
                    p.current && p.current > 0
                      ? `Importing URL: Writing ${p.current}/${p.total}`
                      : `Importing URL: Writing…`,
                  ttlMs: null,
                  dismissible: false,
                  log: false,
                })
                return
              }
              setStatusProgress('Writing')
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
        const firstFailure =
          res.failed.find(f => String((f as { name?: unknown }).name || '').trim() === 'GitHub repo import') || res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        const createdPath = res.createdPaths.find(p => typeof p === 'string' && p.trim()) || null
        const source = createdPath ? res.sources.find(s => s.path === createdPath)?.source : res.sources[0]?.source
        const sourceUrl = source && source.kind === 'url' ? source.url : null
        if (createdPath) await focusAfterImport(createdPath, { sourceUrl, applyToGraph: true, jobId })

        const hydrateWebpageStub = async () => {
          if (!createdPath) return
          if (!sourceUrl) return
          if (importJobRef.current !== jobId) return
          try {
            const current = await fs.readFileText(createdPath)
            if (!current) return
            const meta = parseWebpageFrontmatterMeta(current)
            if (!meta || !meta.url) return
            if (meta.url !== sourceUrl) return
            const body = String(current || '').replace(/^---[\s\S]*?\n---\n?/m, '').trim()
            const looksLikeJsShellText = (text: string): boolean => {
              const t = String(text || '')
              if (!t.trim()) return false
              if (/failed\s+to\s+load\s+posts/i.test(t)) return true
              if (/enable-javascript\.com/i.test(t)) return true
              if (/requires\s+java\s*script/i.test(t)) return true
              if (/page not foundlatesttopdiscussions/i.test(t.replace(/\s+/g, ''))) return true
              return false
            }
            const needsHydration = isFrontmatterOnlyDoc(current) || looksLikeJsShellText(body) || body.length < 220
            if (!needsHydration) return

            const toastHydrateId = `workspace:import:url:hydrate:${hashStringToHex(sourceUrl).slice(0, 10)}`
            setStatusProgress('Fetching')
            useGraphStore.getState().upsertUiToast({
              id: toastHydrateId,
              kind: 'neutral',
              message: `Fetching webpage content…`,
              ttlMs: null,
              dismissible: false,
              log: false,
            })

            const fetched = await fetchWorkspaceUrlContent(sourceUrl, {
              mode: 'refresh',
              onProgress: (p) => {
                const pct = Math.max(0, Math.min(100, Math.floor(Number.isFinite(p) ? p : 0)))
                const phaseLabel = buildWebpageImportStageLabel(pct)
                setStatusProgress(phaseLabel, pct, 100)
                useGraphStore.getState().upsertUiToast({
                  id: toastHydrateId,
                  kind: 'neutral',
                  message: `${phaseLabel} ${pct}%`,
                  ttlMs: null,
                  dismissible: false,
                  log: false,
                })
              },
            })
            if (importJobRef.current !== jobId) return
            if (!fetched || !String(fetched.text || '').trim()) return
            const fetchedMeta = parseWebpageFrontmatterMeta(fetched.text)
            const desiredView = meta.view === 'html' && fetchedMeta?.view === 'markdown' ? 'markdown' : meta.view
            const nextText = normalizeWebpageFrontmatterView(fetched.text, desiredView)
            if (isFrontmatterOnlyDoc(nextText)) return

            setStatusProgress('Writing')
            await fs.writeFileText(createdPath, nextText)
            const inlineText = nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : undefined
            setEntries(prev => prev.map(e => (e.path === createdPath ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))

            if (openedPath === createdPath) {
              lastLoadedRef.current = { path: createdPath, text: nextText }
              setActiveText(nextText)
              if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, nextText)
              setMarkdownDocumentSourceUrl(fetched.normalizedUrl)
            }

            useGraphStore.getState().upsertUiToast({
              id: toastHydrateId,
              kind: 'success',
              message: `Webpage content loaded`,
              ttlMs: 6000,
              dismissible: true,
            })
          } catch {
            void 0
          }
        }

        void hydrateWebpageStub()
        setStatusInfo(imported > 1 ? `Imported ${imported}${suffix}${failureSuffix}` : `Imported URL${suffix}${failureSuffix}`)
        useGraphStore.getState().pushUiLog({
          kind: failed > 0 ? 'warning' : 'success',
          message: `Import URL finished: ${imported} imported${suffix}${failureSuffix}`,
          source: 'workspace:importUrl',
        })
        useGraphStore.getState().pushUiToast({
          id: toastId,
          kind: failed > 0 ? 'warning' : 'success',
          message: imported > 1 ? `Imported ${imported}${suffix}` : `Imported URL${suffix}`,
          ttlMs: 12_000,
          dismissible: true,
        })
      } catch (e) {
        if (importJobRef.current !== jobId) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        setStatusError(`Import failed: ${msg}`)
        useGraphStore.getState().pushUiLog({ kind: 'error', message: `Import URL failed: ${msg}`, source: 'workspace:importUrl' })
        useGraphStore.getState().pushUiToast({
          id: toastId,
          kind: 'error',
          message: `Import failed: ${msg}`,
          ttlMs: 15_000,
          dismissible: true,
        })
      }
    },
    [
      activeDocumentKey,
      buildWebpageImportStageLabel,
      focusAfterImport,
      getFs,
      lastLoadedRef,
      openedPath,
      refresh,
      setActiveText,
      setEntries,
      setMarkdownDocument,
      setMarkdownDocumentSourceUrl,
      setStatusError,
      setStatusInfo,
      setStatusProgress,
    ],
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
        const defaultView = store.webpageImportView
        const generateArtifactDocs = store.websiteImportGenerateWebpageArtifactDocs !== false

        const startRes = await fetch(
          `/__website_import/start?outputDirRel=${encodeURIComponent(outputDirRel)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              url,
              options: { discoverSitemap, maxPages, concurrency, includeImages, generateMarkdownArtifacts: generateArtifactDocs },
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
          let lastProcessed = -1
          let waitMs = 650
          while (true) {
            if (importJobRef.current !== jobId) throw new Error('cancelled')
            const statusRes = await fetch(
              `/__website_import/status?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}`,
              { headers: { Accept: 'application/json' } },
            )
            const statusJson = (await statusRes.json()) as {
              ok?: unknown
              status?: unknown
              progress?:
                | {
                    stage?: unknown
                    total?: unknown
                    processed?: unknown
                    ok?: unknown
                    error?: unknown
                    queued?: unknown
                    lastUrl?: unknown
                    updatedAtMs?: unknown
                  }
                | null
            }
            const status = typeof statusJson.status === 'string' ? statusJson.status : ''
            if (status === 'done') return 'done'
            if (status === 'failed') return 'failed'
            if (Date.now() - startedAtMs > 10 * 60_000) return 'failed'

            const p = statusJson.progress
            const total = p && typeof p.total === 'number' && Number.isFinite(p.total) ? p.total : null
            const processed = p && typeof p.processed === 'number' && Number.isFinite(p.processed) ? p.processed : null
            const stage = p && typeof p.stage === 'string' ? p.stage : ''
            const label =
              stage === 'discovering'
                ? 'Discovering'
                : stage === 'crawling'
                  ? 'Crawling'
                  : stage === 'converting'
                    ? 'Importing'
                    : 'Importing website'
            if (typeof processed === 'number' && typeof total === 'number' && total > 0) {
              setStatusProgress(label, Math.min(total, Math.max(0, processed)), total)
              if (processed === lastProcessed) {
                waitMs = Math.min(1800, waitMs + 150)
              } else {
                waitMs = 650
                lastProcessed = processed
              }
            } else {
              setStatusProgress(label)
              waitMs = Math.min(1800, waitMs + 150)
            }

            await new Promise<void>(resolve => setTimeout(resolve, waitMs))
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
            const normalized = String(rootUrl || '').replace(/\\/g, '/').replace(/\/+$/, '')
            const last = normalized.split('/').filter(Boolean).pop() || ''
            return last || 'website'
          }
        })()

        const ensureFolderPath = async (fs: WorkspaceFs, absPath: string) => {
          const normalized = normalizeWorkspacePath(absPath)
          const segments = normalized.split('/').filter(Boolean)
          let parent = WORKSPACE_ROOT_PATH
          for (const seg of segments) {
            const name = safeWebsitePathSegment(seg)
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

        const coerceWebpageView = (raw: unknown): 'markdown' | 'json' | 'html' =>
          raw === 'html' ? 'html' : raw === 'json' ? 'json' : 'markdown'

        const localSiteRootRel = (() => {
          if (/^https?:\/\//i.test(url)) return ''
          const normalized = url.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.+\//, '').replace(/^\/+/, '')
          if (!normalized || normalized.includes('..')) return ''
          const parts = normalized.split('/').filter(Boolean)
          if (parts.length === 0) return ''
          const leaf = parts[parts.length - 1] || ''
          if (/\.(xml|html|htm)$/i.test(leaf) && parts.length > 1) return parts.slice(0, -1).join('/')
          return normalized
        })()

        const stubForNode = (nodeUrl: string, nodeId: string) => {
          const v = coerceWebpageView(defaultView)
          const lines = [
            '---',
            `kgWebpageUrl: "${nodeUrl}"`,
            `kgWebpageView: "${v}"`,
            !/^https?:\/\//i.test(nodeUrl) && localSiteRootRel ? `kgWebpageSiteRootRel: "${localSiteRootRel}"` : null,
            `kgWebsiteImportId: "${importId}"`,
            `kgWebsiteNodeId: "${nodeId}"`,
          ]
          if (outputDirRel && outputDirRel.trim()) {
            lines.push(`kgWebsiteOutputDirRel: "${outputDirRel.trim()}"`)
          }
          lines.push('---', '')
          return lines.filter(Boolean).join('\n')
        }

        const shouldGenerateArtifactDocs = generateArtifactDocs

        const fs = await getFs()
        await fs.ensureSeed()

        const created = await runWorkspaceFsChangedBatch(async () => {
          const rootFolder = await ensureFolderPath(fs, `/websites/${safeWebsitePathSegment(host)}/${safeWebsitePathSegment(importId)}`)
          const createdPaths: WorkspacePath[] = []
          const sources: Array<{ path: WorkspacePath; source: { kind: 'url'; url: string; path: string } }> = []
          const docLinkByNodeId: Record<string, string> = {}

          const ctrl = new AbortController()
          const nodeRows = nodes
            .map((n) => {
              const node = n || {}
              const nodeUrl = typeof node.url === 'string' ? node.url : ''
              const nodeId = typeof node.nodeId === 'string' ? node.nodeId : hashStringToHex(nodeUrl).slice(0, 16)
              const nodeTreePath = typeof node.path === 'string' ? node.path : ''
              const status = typeof node.status === 'string' ? node.status : 'ok'
              if (!nodeUrl || status !== 'ok') return null
              const row = { nodeUrl, nodeId, nodeTreePath } as {
                nodeUrl: string
                nodeId: string
                nodeTreePath: string
                nodeTitle?: string
              }
              const title = typeof node.title === 'string' ? node.title : ''
              if (title) row.nodeTitle = title
              return row
            })
            .filter((v): v is { nodeUrl: string; nodeId: string; nodeTreePath: string; nodeTitle?: string } => !!v)

          const folderCache = new Map<string, WorkspacePath>()
          folderCache.set(rootFolder, rootFolder)

          const ensureFolderCached = async (absPath: string) => {
            const normalized = normalizeWorkspacePath(absPath)
            const cached = folderCache.get(normalized)
            if (cached) return cached
            const created = await ensureFolderPath(fs, normalized)
            folderCache.set(normalized, created)
            folderCache.set(normalizeWorkspacePath(created), created)
            return created
          }

          const totalWrites = nodeRows.length
          let lastUiAtMs = 0
          const writeConcurrency = shouldGenerateArtifactDocs ? Math.max(1, Math.min(2, concurrency)) : Math.max(1, Math.min(6, concurrency))

          await mapLimit(
            nodeRows,
            writeConcurrency,
            async (row) => {
              if (importJobRef.current !== jobId) throw new Error('cancelled')
              const nodePath = (() => {
                try {
                  const raw = row.nodeTreePath && row.nodeTreePath.trim() ? row.nodeTreePath : new URL(row.nodeUrl).pathname
                  const parts = String(raw || '').split('/').filter(Boolean)
                  return parts.map(safeWebsitePathSegment)
                } catch {
                  return []
                }
              })()
              const leaf = nodePath[nodePath.length - 1] || 'index'
              const folderParts = nodePath.slice(0, Math.max(0, nodePath.length - 1))
              const folderPath = folderParts.length ? await ensureFolderCached(`${rootFolder}/${folderParts.join('/')}`) : rootFolder

              const base = leaf || 'index'
              const nameBase = base.endsWith('.md') ? base.replace(/\.md$/i, '') : base
              const primaryName = `${nameBase}.md`
              const text = await (async () => {
                if (!shouldGenerateArtifactDocs) return stubForNode(row.nodeUrl, row.nodeId)
                try {
                  const serverMarkdown = await (async () => {
                    try {
                      const t = await fetchWebsiteImportArtifact({
                        importId,
                        nodeId: row.nodeId,
                        outputDirRel: outputDirRel || undefined,
                        kind: 'markdown',
                        signal: ctrl.signal,
                      })
                      if (t && t.trim()) return t
                    } catch {
                      void 0
                    }
                    return ''
                  })()

                  if (serverMarkdown) {
                    return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                      upstreamMarkdown: serverMarkdown,
                      url: row.nodeUrl,
                      view: coerceWebpageView(defaultView),
                      title: row.nodeTitle,
                      websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: outputDirRel || undefined },
                    })
                  }

                  const rawHtml = await fetchWebsiteImportArtifact({
                    importId,
                    nodeId: row.nodeId,
                    outputDirRel: outputDirRel || undefined,
                    kind: 'rawHtml',
                    signal: ctrl.signal,
                  })
                  const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
                  const markdown = await convertWebpageHtmlToMarkdownArtifactAsync({
                    html: boundedHtml,
                    url: row.nodeUrl,
                    includeImages: true,
                    fidelityLevel: 4,
                  })
                  return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                    upstreamMarkdown: markdown,
                    url: row.nodeUrl,
                    view: coerceWebpageView(defaultView),
                    title: row.nodeTitle,
                    websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: outputDirRel || undefined },
                  })
                } catch {
                  return stubForNode(row.nodeUrl, row.nodeId)
                }
              })()

              const tryCreate = async (name: string) => {
                const createdPath = await fs.createFile({ parentPath: folderPath, name, text })
                createdPaths.push(createdPath)
                sources.push({ path: createdPath, source: { kind: 'url', url: row.nodeUrl, path: `workspace:${createdPath}` } })
                try {
                  const normalizedRoot = normalizeWorkspacePath(rootFolder)
                  const normalizedCreated = normalizeWorkspacePath(createdPath)
                  const rel = normalizedCreated.startsWith(normalizedRoot + '/')
                    ? normalizedCreated.slice(normalizedRoot.length + 1)
                    : normalizedCreated.replace(/^\/+/, '')
                  if (rel) docLinkByNodeId[row.nodeId] = `./${rel}`
                } catch {
                  void 0
                }
                return createdPath
              }

              try {
                await tryCreate(primaryName)
              } catch {
                const alt = `${nameBase}-${hashStringToHex(row.nodeUrl).slice(0, 6)}.md`
                try {
                  await tryCreate(alt)
                } catch {
                  void 0
                }
              }
            },
            {
              signal: ctrl.signal,
              yieldEvery: shouldGenerateArtifactDocs ? 1 : 12,
              onProgress: ({ done, total }) => {
                const now = Date.now()
                if (now - lastUiAtMs < 150 && done !== total) return
                lastUiAtMs = now
                setStatusProgress('Writing', done, total)
              },
            },
          )

          try {
            const sitemapText = buildWebsiteSitemapMarkdown({
              rootUrl,
              importId,
              outputDirRel: outputDirRel || undefined,
              docLinkByNodeId,
              nodes: nodes
                .map((node) => {
                  const nodeUrl = typeof node.url === 'string' ? node.url : ''
                  const nodeId = typeof node.nodeId === 'string' ? node.nodeId : ''
                  const nodeTreePath = typeof node.path === 'string' ? node.path : ''
                  const title = typeof node.title === 'string' ? node.title : null
                  return { nodeId, url: nodeUrl, path: nodeTreePath, title }
                })
                .filter(n => n.url),
            })
            const sitemapPath = await fs.createFile({ parentPath: rootFolder, name: 'website.sitemap.md', text: sitemapText })
            createdPaths.unshift(sitemapPath)
            sources.unshift({
              path: sitemapPath,
              source: { kind: 'url', url: rootUrl, path: `workspace:${sitemapPath}` },
            })
          } catch {
            void 0
          }

          setStatusProgress('Writing', totalWrites, totalWrites)
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
    [focusAfterImport, getFs, refresh, setStatusError, setStatusInfo, setStatusProgress],
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
        const prevText = await fs.readFileText(normalized).catch(() => '')
        const prevFm = prevText ? extractYamlFrontmatterBlock(prevText) : null
        const prevMeta = prevText ? parseWebpageFrontmatterMeta(prevText) : null
        const prevViewRaw = prevFm ? readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageView') : ''
        const prevHasScript = !!(prevFm && readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageScriptPolicy'))
        const prevHasImages = !!(prevFm && readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageIncludeImages'))
        const prevHasFidelity = !!(prevFm && readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageFidelityLevel'))

        const fetched = await fetchWorkspaceUrlContent(src.url, {
          mode: 'refresh',
          onProgress: (p) => setStatusProgress('Refreshing', p, 100),
        })
        let nextText = fetched.text
        if (prevMeta && prevMeta.url) {
          const desiredView = prevViewRaw === 'html' ? 'html' : prevViewRaw === 'json' ? 'json' : prevViewRaw === 'markdown' ? 'markdown' : ''
          if (desiredView) nextText = normalizeWebpageFrontmatterView(nextText, desiredView as 'html' | 'json' | 'markdown')
          if (prevHasScript || prevHasImages || prevHasFidelity || prevMeta.siteRootRel) {
            nextText = upsertWebpageFrontmatterMeta(nextText, {
              url: prevMeta.url,
              view: desiredView === 'json' ? 'json' : desiredView === 'html' ? 'html' : 'markdown',
              siteRootRel: prevMeta.siteRootRel,
              scriptPolicy: prevHasScript ? prevMeta.scriptPolicy : undefined,
              includeImages: prevHasImages ? prevMeta.includeImages : undefined,
              fidelityLevel: prevHasFidelity ? prevMeta.fidelityLevel : undefined,
            })
          }
        }

        await fs.writeFileText(normalized, nextText)
        const inlineText = nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : undefined
        setEntries(prev => prev.map(e => (e.path === normalized ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        if (openedPath === normalized) {
          lastLoadedRef.current = { path: normalized, text: nextText }
          setActiveText(nextText)
          if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, nextText)
          setMarkdownDocumentSourceUrl(fetched.normalizedUrl)
          void 0
        }
        setStatusInfo('Refreshed')
      } catch (e) {
        setStatusError(`Refresh failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activeDocumentKey,
      openedPath,
      getFs,
      lastLoadedRef,
      setActiveText,
      setEntries,
      setMarkdownDocument,
      setMarkdownDocumentSourceUrl,
      setStatusError,
      setStatusInfo,
      setStatusProgress,
    ],
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
    [getFs, refresh, setStatusError, setStatusInfo, setStatusProgress],
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
    [
      activeDocumentKey,
      openedPath,
      getFs,
      lastLoadedRef,
      setActiveText,
      setEntries,
      setMarkdownDocument,
      setStatusError,
      setStatusInfo,
      setStatusProgress,
    ],
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
    [
      activeDocumentKey,
      openedPath,
      getFs,
      lastLoadedRef,
      setActiveText,
      setEntries,
      setMarkdownDocument,
      setStatusError,
      setStatusInfo,
      setStatusProgress,
    ],
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
