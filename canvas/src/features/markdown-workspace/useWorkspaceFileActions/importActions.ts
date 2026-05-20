import React from 'react'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { runWorkspaceFsChangedBatch, suppressNextWorkspaceFsChangedEvent } from '@/features/workspace-fs/workspaceFsEvents'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { activateDesignEditorSurface } from '@/features/design/designEditorLaunchState'
import { bulkSetWorkspaceEntrySources } from '@/features/workspace-fs/sourceIndex'
import { writeWorkspaceFileAndSync } from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.io'
import type { Canvas2dRendererId } from '@/lib/config.render'
import {
  getWorkspaceUrlImportCanvasRendererLabel,
  isWorkspaceUrlImportCanvasRendererId,
  normalizeWorkspaceUrlImportDocumentMode,
} from '../workspaceImport/canvasPresets'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  importWorkspaceUrl,
} from '../workspaceImport'
import type { WorkspaceImportResult } from '../workspaceImport/types'
import type { WorkspaceImportActionsCtx } from './types'

const loadWorkspaceImportRuntimeActions = (): Promise<typeof import('./importRuntimeActions')> => import('./importRuntimeActions')

export function useWorkspaceImportActions(args: {
  core: {
    importJobRef: React.MutableRefObject<number>
    status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
    focusAfterImport: (createdPath: string, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
  }
  ctx: WorkspaceImportActionsCtx
}) {
  const { importJobRef, status, focusAfterImport } = args.core
  const {
    getFs,
    refresh,
    openedPath,
    activeDocumentKey,
    setActiveText,
    setEntries,
    lastLoadedRef,
    setActiveMarkdownDocument,
  } = args.ctx

  const hydratePendingImportedPaths = React.useCallback(async (fs: WorkspaceFs, createdPaths: string[]) => {
    for (const path of createdPaths || []) {
      const nextPath = String(path || '').trim()
      if (!nextPath) continue
      await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: nextPath }).catch(() => null)
    }
  }, [])

  const syncImportedExternalWrite = React.useCallback(
    async (
      fs: WorkspaceFs,
      path: WorkspacePath | null | undefined,
      opts?: { sourceUrl?: string | null },
    ) => {
      const normalized = normalizeWorkspacePath(path || '')
      if (!normalized || normalized === WORKSPACE_ROOT_PATH) return
      const text = String((await fs.readFileText(normalized).catch(() => '')) || '')
      await writeWorkspaceFileAndSync({
        path: normalized,
        text,
        getFs: async () => fs,
        skipWrite: true,
        lastLoadedRef,
        setEntries,
        synchronizeActiveDocument: openedPath === normalized,
        setActiveText,
        activeDocumentKey: workspaceDocumentKey(normalized) || activeDocumentKey,
        activeDocumentSourceUrl: opts?.sourceUrl ?? null,
        setActiveMarkdownDocument,
        resetParsedState: false,
      })
    },
    [
      activeDocumentKey,
      lastLoadedRef,
      openedPath,
      setActiveMarkdownDocument,
      setActiveText,
      setEntries,
    ],
  )

  const finalizeWorkspaceImportCommit = React.useCallback(
    async (args: {
      fs: WorkspaceFs
      result: WorkspaceImportResult
      hydratePending: boolean
      applyToGraph: boolean
      resolveSourceUrl?: boolean
    }) => {
      const { fs, result } = args
      const {
        applyWorkspaceImportToCanvasBestEffort,
        pickFirstCreatedFilePathForImportFocus,
      } = await loadWorkspaceImportRuntimeActions()
      bulkSetWorkspaceEntrySources(result.sources)
      if (args.hydratePending) {
        await hydratePendingImportedPaths(fs, result.createdPaths)
      }
      const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, result.createdPaths)
      if (args.applyToGraph && createdPath) {
        try {
          useMarkdownExplorerStore.getState().setActivePath(createdPath as WorkspacePath)
        } catch {
          void 0
        }
      }
      const refreshed = await refresh()
      await applyWorkspaceImportToCanvasBestEffort({
        fs,
        createdPaths: result.createdPaths,
        opts: {
          applyToGraph: args.applyToGraph === true,
          workspaceEntries: refreshed.entries,
          sourcesByPath: refreshed.sourcesByPath,
        },
      })
      const source = args.resolveSourceUrl && createdPath ? result.sources.find(s => s.path === createdPath)?.source : result.sources[0]?.source
      const sourceUrl = source && source.kind === 'url' ? source.url : null
      if (createdPath) await syncImportedExternalWrite(fs, createdPath, { sourceUrl })
      return { createdPath, sourceUrl }
    },
    [hydratePendingImportedPaths, refresh, syncImportedExternalWrite],
  )

  const formatWorkspaceImportSummary = React.useCallback(
    (prefix: string, result: WorkspaceImportResult) => {
      const imported = result.createdPaths.length
      const skipped = result.skipped.length
      const failed = result.failed.length
      const suffix = skipped || failed ? ` (skipped ${skipped}, failed ${failed})` : ''
      const firstFailure = prefix === 'Imported URL'
        ? result.failed.find(f => String((f as { name?: unknown }).name || '').trim() === 'GitHub repo import') || result.failed[0]
        : result.failed[0]
      const failureSuffix =
        failed > 0 && firstFailure
          ? `: ${String(firstFailure.name || 'file').trim() || 'file'} — ${String(firstFailure.error || '').trim() || 'failed'}`
          : ''
      return {
        imported,
        skipped,
        failed,
        suffix,
        failureSuffix,
        message: `${prefix}${prefix.endsWith(': ') ? imported : imported > 1 && prefix === 'Imported URL' ? ` ${imported}` : ` ${imported}`}${suffix}${failureSuffix}`,
      }
    },
    [],
  )

  const handleImportLocalFiles = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      status.setStatusProgress('Importing', 0, snapshot.length)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const importRuntime = await loadWorkspaceImportRuntimeActions()
        const res = importRuntime.normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
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
        const applyToGraph = typeof res.applyToGraph === 'boolean'
          ? res.applyToGraph
          : await importRuntime.resolveImportedCanvasDocumentApplyToGraph({
              fs,
              createdPaths: res.createdPaths,
            })
        if (importJobRef.current !== jobId) return
        const { createdPath } = await finalizeWorkspaceImportCommit({
          fs,
          result: res,
          hydratePending: false,
          applyToGraph,
        })
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph, jobId })
        }
        status.setStatusInfo(formatWorkspaceImportSummary('Imported', res).message)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        status.setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [finalizeWorkspaceImportCommit, focusAfterImport, formatWorkspaceImportSummary, getFs, importJobRef, status],
  )

  const handleImportLocalFolder = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      const jobId = (importJobRef.current += 1)
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const importRuntime = await loadWorkspaceImportRuntimeActions()
        const res = importRuntime.normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
          suppressNextWorkspaceFsChangedEvent()
          return importWorkspaceLocalFolder({
            fs,
            files: snapshot,
          })
        }))
        if (importJobRef.current !== jobId) return
        const applyToGraph = typeof res.applyToGraph === 'boolean'
          ? res.applyToGraph
          : await importRuntime.resolveImportedCanvasDocumentApplyToGraph({
              fs,
              createdPaths: res.createdPaths,
            })
        if (importJobRef.current !== jobId) return
        const { createdPath } = await finalizeWorkspaceImportCommit({
          fs,
          result: res,
          hydratePending: false,
          applyToGraph,
        })
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph, jobId })
        }
        status.setStatusInfo(formatWorkspaceImportSummary('Imported folder:', res).message)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        status.setStatusError(`Import failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [finalizeWorkspaceImportCommit, focusAfterImport, formatWorkspaceImportSummary, getFs, importJobRef, status],
  )

  const handleImportUrl = React.useCallback(
    async (urlRaw: string, opts?: { canvas2dRenderer?: Canvas2dRendererId | null; documentSemanticMode?: 'document' | 'keyword' | null }) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const selectedCanvas2dRenderer = isWorkspaceUrlImportCanvasRendererId(opts?.canvas2dRenderer) ? opts?.canvas2dRenderer : null
      const selectedDocumentSemanticMode = selectedCanvas2dRenderer ? normalizeWorkspaceUrlImportDocumentMode(opts?.documentSemanticMode) : null
      const importKindLabel = selectedCanvas2dRenderer
        ? `Importing URL (${getWorkspaceUrlImportCanvasRendererLabel(selectedCanvas2dRenderer)})`
        : 'Importing URL'
      const jobId = (importJobRef.current += 1)
      status.setStatusProgress(importKindLabel)
      useGraphStore.getState().pushUiLog({ kind: 'neutral', message: `Import URL started: ${url}`, source: 'workspace:importUrl' })
      try {
        const fs = await getFs()
        await fs.ensureSeed()
        const importRuntime = await loadWorkspaceImportRuntimeActions()
        const maxImportLogRows = 59
        let logCount = 1
        let lastLabel = ''
        const res = importRuntime.normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => {
          suppressNextWorkspaceFsChangedEvent()
          return importWorkspaceUrl({
            fs,
            urlRaw: url,
            parentPath: WORKSPACE_ROOT_PATH,
            canvas2dRenderer: selectedCanvas2dRenderer,
            documentSemanticMode: selectedDocumentSemanticMode,
            viewHint: selectedCanvas2dRenderer ? 'html' : undefined,
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
        const summary = formatWorkspaceImportSummary('Imported URL', res)
        const applyToGraph = typeof res.applyToGraph === 'boolean'
          ? res.applyToGraph
          : await importRuntime.resolveImportedCanvasDocumentApplyToGraph({
              fs,
              createdPaths: res.createdPaths,
            })
        if (importJobRef.current !== jobId) return
        const { createdPath, sourceUrl } = await finalizeWorkspaceImportCommit({
          fs,
          result: res,
          hydratePending: false,
          applyToGraph,
          resolveSourceUrl: true,
        })

        if (createdPath) {
          await focusAfterImport(createdPath, { sourceUrl, applyToGraph, jobId })
        }
        if (selectedCanvas2dRenderer === 'design') {
          activateDesignEditorSurface({ openFloatingPanel: true })
        }

        status.setStatusInfo(summary.imported > 1 ? `Imported ${summary.imported}${summary.suffix}${summary.failureSuffix}` : `Imported URL${summary.suffix}${summary.failureSuffix}`)
        useGraphStore.getState().pushUiLog({
          kind: summary.failed > 0 ? 'warning' : 'success',
          message: `Import URL finished: ${summary.imported} imported${summary.suffix}${summary.failureSuffix}`,
          source: 'workspace:importUrl',
        })
      } catch (e) {
        if (importJobRef.current !== jobId) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        status.setStatusError(`Import failed: ${msg}`)
        useGraphStore.getState().pushUiLog({ kind: 'error', message: `Import URL failed: ${msg}`, source: 'workspace:importUrl' })
      }
    },
    [finalizeWorkspaceImportCommit, focusAfterImport, formatWorkspaceImportSummary, getFs, importJobRef, status],
  )

  return { handleImportLocalFiles, handleImportLocalFolder, handleImportUrl }
}
