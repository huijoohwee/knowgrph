import React from 'react'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { runWorkspaceFsChangedBatch, suppressNextWorkspaceFsChangedEvent } from '@/features/workspace-fs/workspaceFsEvents'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { isFrontmatterOnlyDoc, normalizeWebpageFrontmatterView, parseWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { bulkSetWorkspaceEntrySources, type WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { writeWorkspaceFileAndSync } from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.io'
import {
  fetchWorkspaceUrlContent,
  hydrateWorkspaceFileFromPendingLocalImport,
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  importWorkspaceUrl,
} from '../workspaceImport'
import type { WorkspaceImportResult } from '../workspaceImport/types'
import type { UseWorkspaceFileActionsArgs } from './types'

export function normalizeWorkspaceImportResult(raw: unknown): WorkspaceImportResult {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const createdPaths = Array.isArray(rec.createdPaths)
    ? rec.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  const sources = Array.isArray(rec.sources)
    ? rec.sources
        .map((item): WorkspaceImportResult['sources'][number] | null => {
          const path = String((item as { path?: unknown } | null)?.path || '').trim() as WorkspacePath
          const rawSource = (item as { source?: unknown } | null)?.source
          if (!path || !rawSource || typeof rawSource !== 'object') return null
          const kind = String((rawSource as { kind?: unknown }).kind || '').trim()
          if (kind === 'url') {
            const url = String((rawSource as { url?: unknown }).url || '').trim()
            if (!url) return null
            return { path, source: { kind: 'url' as const, url } }
          }
          if (kind === 'local') {
            const originalName = typeof (rawSource as { originalName?: unknown }).originalName === 'string'
              ? String((rawSource as { originalName?: string }).originalName || '').trim()
              : ''
            return originalName
              ? { path, source: { kind: 'local' as const, originalName } }
              : { path, source: { kind: 'local' as const } }
          }
          return null
        })
        .filter((item): item is WorkspaceImportResult['sources'][number] => !!item)
    : []
  const skipped = Array.isArray(rec.skipped)
    ? rec.skipped
        .map(item => {
          const name = String((item as { name?: unknown } | null)?.name || '').trim()
          const reasonRaw = String((item as { reason?: unknown } | null)?.reason || '').trim()
          const reason = reasonRaw === 'missing-name' ? 'missing-name' : reasonRaw === 'unsupported' ? 'unsupported' : ''
          if (!reason) return null
          return { name, reason }
        })
        .filter((item): item is WorkspaceImportResult['skipped'][number] => !!item)
    : []
  const failed = Array.isArray(rec.failed)
    ? rec.failed
        .map(item => {
          const name = String((item as { name?: unknown } | null)?.name || '').trim()
          const error = String((item as { error?: unknown } | null)?.error || '').trim()
          if (!error) return null
          return { name, error }
        })
        .filter((item): item is WorkspaceImportResult['failed'][number] => !!item)
    : []
  return { createdPaths, sources, skipped, failed }
}

export async function applyWorkspaceImportToCanvasBestEffort(args: {
  fs: WorkspaceFs
  createdPaths: string[]
  opts?: {
    applyToGraph?: boolean
    workspaceEntries?: WorkspaceEntry[]
    sourcesByPath?: Record<string, WorkspaceEntrySource | undefined> | null
  } | null
}): Promise<void> {
  const createdPaths = Array.isArray(args.createdPaths)
    ? args.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  if (createdPaths.length === 0) return
  try {
    const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
      '@/features/workspace-fs/applyWorkspaceImportToCanvas'
    )
    await applyWorkspaceImportToCanvas({
      fs: args.fs,
      createdPaths,
      ...(args.opts ? { opts: args.opts } : {}),
    })
  } catch {
    void 0
  }
}

export async function pickFirstCreatedFilePathForImportFocus(fs: WorkspaceFs, createdPaths: string[]): Promise<string | null> {
  const normalized = Array.isArray(createdPaths) ? createdPaths.map(path => String(path || '').trim()).filter(Boolean) : []
  if (normalized.length === 0) return null

  try {
    const createdSet = new Set(normalized)
    const entries = await fs.listEntries()
    const firstFile = entries.find(entry => entry.kind === 'file' && createdSet.has(String(entry.path || '').trim()))
    if (firstFile) return String(firstFile.path || '').trim() || null
  } catch {
    void 0
  }

  const fileLike = normalized.find(path => /\/[^/]+\.[^/]+$/.test(path))
  if (fileLike) return fileLike
  return normalized[0] || null
}

export async function activateFirstImportedWorkspaceFile(args: {
  fs: WorkspaceFs
  createdPaths: string[]
}): Promise<void> {
  const createdPaths = Array.isArray(args.createdPaths)
    ? args.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  if (createdPaths.length === 0) return
  try {
    const [
      { workspaceBasename, workspaceDocumentKey },
      { normalizeMermaidMmdToMarkdown },
      { hydrateWorkspaceFileFromPendingLocalImport },
    ] = await Promise.all([
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      import('grph-shared/markdown/mermaidInput') as Promise<typeof import('grph-shared/markdown/mermaidInput')>,
      import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
        typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
      >,
    ])

    const firstPath = (await pickFirstCreatedFilePathForImportFocus(args.fs, createdPaths)) || ''
    if (!firstPath) return

    const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs: args.fs, path: firstPath }).catch(() => null)
    const text = String((hydrated?.text || (await args.fs.readFileText(firstPath).catch(() => ''))) || '')
    const docKey = workspaceDocumentKey(firstPath)
    const name = docKey || workspaceBasename(firstPath) || firstPath
    const state = useGraphStore.getState()
    const normalizedPath = firstPath as WorkspacePath
    try {
      useMarkdownExplorerStore.getState().setActivePath(normalizedPath)
    } catch {
      try {
        useMarkdownExplorerStore.setState({
          activePath: normalizedPath,
          lastSetActivePath: { path: normalizedPath, atMs: Date.now() },
        })
      } catch {
        void 0
      }
    }

    await state.setActiveMarkdownDocument({
      name,
      text: normalizeMermaidMmdToMarkdown(name, text),
      normalizeMermaidMmd: false,
      sourceUrl: null,
      jsonSourceText: null,
      applyToGraph: false,
    })
  } catch {
    void 0
  }
}

function looksLikeJsShellText(text: string): boolean {
  const t = String(text || '')
  if (!t.trim()) return false
  if (/failed\s+to\s+load\s+posts/i.test(t)) return true
  if (/enable-javascript\.com/i.test(t)) return true
  if (/requires\s+java\s*script/i.test(t)) return true
  if (/page not foundlatesttopdiscussions/i.test(t.replace(/\s+/g, ''))) return true
  return false
}

export function useWorkspaceImportActions(args: {
  core: {
    importJobRef: React.MutableRefObject<number>
    status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
    focusAfterImport: (createdPath: string, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
  }
  ctx: Pick<
    UseWorkspaceFileActionsArgs,
    'getFs' | 'refresh' | 'openedPath' | 'activeDocumentKey' | 'setActiveText' | 'setEntries' | 'lastLoadedRef' | 'setActiveMarkdownDocument'
  >
}) {
  const { importJobRef, status, focusAfterImport } = args.core
  const { getFs, refresh, openedPath, activeDocumentKey, setActiveText, setEntries, lastLoadedRef, setActiveMarkdownDocument } = args.ctx

  const hydratePendingImportedPaths = React.useCallback(async (fs: WorkspaceFs, createdPaths: string[]) => {
    for (const path of createdPaths || []) {
      const nextPath = String(path || '').trim()
      if (!nextPath) continue
      await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: nextPath }).catch(() => null)
    }
  }, [])

  const handleImportLocalFiles = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      status.setStatusProgress('Importing', 0, snapshot.length)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
          suppressNextWorkspaceFsChangedEvent()
          return importWorkspaceLocalFiles({
            fs,
            files: snapshot,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              if (importJobRef.current !== jobId) return
              status.setStatusProgress(p.label || 'Importing', p.current, p.total, p.bytesCurrent, p.bytesTotal)
            },
          })
        }))
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await hydratePendingImportedPaths(fs, res.createdPaths)
        const refreshed = await refresh()
        await applyWorkspaceImportToCanvasBestEffort({
          fs,
          createdPaths: res.createdPaths,
          opts: {
            workspaceEntries: refreshed.entries,
            sourcesByPath: refreshed.sourcesByPath,
          },
        })
        const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, res.createdPaths)
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph: false, jobId })
        }
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        const firstFailure = res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        status.setStatusInfo(`Imported ${imported}${suffix}${failureSuffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        status.setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, hydratePendingImportedPaths, refresh, importJobRef, status],
  )

  const handleImportLocalFolder = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
          suppressNextWorkspaceFsChangedEvent()
          return importWorkspaceLocalFolder({
            fs,
            files: snapshot,
          })
        }))
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await hydratePendingImportedPaths(fs, res.createdPaths)
        const refreshed = await refresh()
        await applyWorkspaceImportToCanvasBestEffort({
          fs,
          createdPaths: res.createdPaths,
          opts: {
            workspaceEntries: refreshed.entries,
            sourcesByPath: refreshed.sourcesByPath,
          },
        })
        const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, res.createdPaths)
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph: false, jobId })
        }
        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        const firstFailure = res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        status.setStatusInfo(`Imported folder: ${imported}${suffix}${failureSuffix}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        status.setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [focusAfterImport, getFs, hydratePendingImportedPaths, refresh, importJobRef, status],
  )

  const handleImportUrl = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      status.setStatusProgress('Importing URL')
      useGraphStore.getState().pushUiLog({ kind: 'neutral', message: `Import URL started: ${url}`, source: 'workspace:importUrl' })
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const maxImportLogRows = 59
        let logCount = 1
        let lastLabel = ''
        const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
          suppressNextWorkspaceFsChangedEvent()
          return importWorkspaceUrl({
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
                status.setStatusProgress(p.label ? String(p.label) : 'Listing')
                return
              }
              if (p.phase === 'fetching' && p.total && p.total > 0) {
                const pct = p.current && p.current > 0 ? (p.current / p.total) * 100 : 0
                const stageLabel = status.buildWebpageImportStageLabel(pct)
                const pctInt = Math.max(0, Math.min(100, Math.floor(pct)))
                status.setStatusProgress(stageLabel, pctInt, 100)
                return
              }
              if (p.phase === 'fetching') {
                const stageLabel = status.buildWebpageImportStageLabel(0)
                status.setStatusProgress(stageLabel)
                return
              }
              if (p.total && p.total > 0) {
                const label = 'Writing'
                if (p.current && p.current > 0) status.setStatusProgress(label, p.current, p.total)
                else status.setStatusProgress(label)
                return
              }
              status.setStatusProgress('Writing')
            },
          })
        }))
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        const refreshed = await refresh()

        const imported = res.createdPaths.length
        const skipped = res.skipped.length
        const failed = res.failed.length
        const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
        const firstFailure = res.failed.find(f => String((f as { name?: unknown }).name || '').trim() === 'GitHub repo import') || res.failed[0]
        const failureSuffix =
          failed > 0 && firstFailure
            ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
            : ''
        const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, res.createdPaths)
        const source = createdPath ? res.sources.find(s => s.path === createdPath)?.source : res.sources[0]?.source
        const sourceUrl = source && source.kind === 'url' ? source.url : null

        const shouldApplyToGraph = true

        await applyWorkspaceImportToCanvasBestEffort({
          fs,
          createdPaths: res.createdPaths,
          opts: {
            applyToGraph: shouldApplyToGraph,
            workspaceEntries: refreshed.entries,
            sourcesByPath: refreshed.sourcesByPath,
          },
        })

        if (createdPath) {
          await focusAfterImport(createdPath, { sourceUrl, applyToGraph: false, jobId })
        }

        const hydrateWebpageStub = async () => {
          if (!createdPath) return
          if (!sourceUrl) return
          if (importJobRef.current !== jobId) return
          try {
            const current = await (await getFs()).readFileText(createdPath)
            if (!current) return
            const meta = parseWebpageFrontmatterMeta(current)
            if (!meta || !meta.url) return
            if (meta.url !== sourceUrl) return
            if (meta.hydrate === false) return

            const body = String(current || '').replace(/^---[\s\S]*?\n---\n?/m, '').trim()
            const needsHydration = (isFrontmatterOnlyDoc(current) || looksLikeJsShellText(body) || body.length < 220) && meta.view === 'markdown'
            if (!needsHydration) return

            status.setStatusProgress('Fetching')

            const fetched = await fetchWorkspaceUrlContent(sourceUrl, {
              mode: 'refresh',
              viewHint: 'markdown',
              onProgress: p => {
                const pct = Math.max(0, Math.min(100, Math.floor(Number.isFinite(p) ? p : 0)))
                const phaseLabel = status.buildWebpageImportStageLabel(pct)
                status.setStatusProgress(phaseLabel, pct, 100)
              },
            })
            if (importJobRef.current !== jobId) return
            if (!fetched || !String(fetched.text || '').trim()) {
              status.setStatusWarning('Webpage content unavailable', { ttlMs: UI_TOAST_TTL_MS.warningExtended, dismissible: true })
              return
            }
            const nextText = normalizeWebpageFrontmatterView(fetched.text, 'markdown')
            if (isFrontmatterOnlyDoc(nextText)) {
              status.setStatusWarning('Webpage content unavailable', { ttlMs: UI_TOAST_TTL_MS.warningExtended, dismissible: true })
              return
            }

            status.setStatusProgress('Writing')
            await writeWorkspaceFileAndSync({
              path: createdPath,
              text: nextText,
              getFs,
              lastLoadedRef,
              setEntries,
              synchronizeActiveDocument: openedPath === createdPath,
              setActiveText,
              activeDocumentKey,
              activeDocumentSourceUrl: fetched.normalizedUrl,
              setActiveMarkdownDocument,
              resetParsedState: true,
            })

            status.setStatusInfo('Webpage content loaded', { ttlMs: UI_TOAST_TTL_MS.warningExtended, dismissible: true })
          } catch {
            void 0
          }
        }

        void hydrateWebpageStub()
        status.setStatusInfo(imported > 1 ? `Imported ${imported}${suffix}${failureSuffix}` : `Imported URL${suffix}${failureSuffix}`)
        useGraphStore.getState().pushUiLog({
          kind: failed > 0 ? 'warning' : 'success',
          message: `Import URL finished: ${imported} imported${suffix}${failureSuffix}`,
          source: 'workspace:importUrl',
        })
      } catch (e) {
        if (importJobRef.current !== jobId) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        status.setStatusError(`Import failed: ${msg}`)
        useGraphStore.getState().pushUiLog({ kind: 'error', message: `Import URL failed: ${msg}`, source: 'workspace:importUrl' })
      }
    },
    [activeDocumentKey, focusAfterImport, getFs, importJobRef, lastLoadedRef, openedPath, refresh, setActiveMarkdownDocument, setActiveText, setEntries, status],
  )

  return { handleImportLocalFiles, handleImportLocalFolder, handleImportUrl }
}
