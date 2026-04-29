import React from 'react'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { runWorkspaceFsChangedBatch } from '@/features/workspace-fs/workspaceFsEvents'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { isFrontmatterOnlyDoc, normalizeWebpageFrontmatterView, parseWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { bulkSetWorkspaceEntrySources } from '@/features/workspace-fs/sourceIndex'
import { WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import {
  fetchWorkspaceUrlContent,
  hydrateWorkspaceFileFromPendingLocalImport,
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  importWorkspaceUrl,
} from '../workspaceImport'
import type { UseWorkspaceFileActionsArgs } from './types'

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
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFiles({
            fs,
            files: snapshot,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              if (importJobRef.current !== jobId) return
              status.setStatusProgress(p.label || 'Importing', p.current, p.total, p.bytesCurrent, p.bytesTotal)
            },
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await hydratePendingImportedPaths(fs, res.createdPaths)
        await refresh()
        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths })
        } catch {
          void 0
        }
        const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, res.createdPaths)
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph: true, jobId })
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
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFolder({
            fs,
            files: snapshot,
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await hydratePendingImportedPaths(fs, res.createdPaths)
        await refresh()
        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths })
        } catch {
          void 0
        }
        const createdPath = await pickFirstCreatedFilePathForImportFocus(fs, res.createdPaths)
        if (createdPath) {
          await focusAfterImport(createdPath, { applyToGraph: true, jobId })
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
          }),
        )
        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(res.sources)
        await refresh()

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

        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths, opts: { applyToGraph: shouldApplyToGraph } })
        } catch {
          void 0
        }

        if (createdPath) {
          await focusAfterImport(createdPath, { sourceUrl, applyToGraph: shouldApplyToGraph, jobId })
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
              status.setStatusWarning('Webpage content unavailable', { ttlMs: 6000, dismissible: true })
              return
            }
            const nextText = normalizeWebpageFrontmatterView(fetched.text, 'markdown')
            if (isFrontmatterOnlyDoc(nextText)) {
              status.setStatusWarning('Webpage content unavailable', { ttlMs: 6000, dismissible: true })
              return
            }

            status.setStatusProgress('Writing')
            const fs = await getFs()
            await fs.writeFileText(createdPath, nextText)
            const inlineText = nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : undefined
            setEntries(prev => {
              let changed = false
              const next = prev.map(e => {
                if (e.path !== createdPath) return e
                if (e.text === inlineText) return e
                changed = true
                return { ...e, text: inlineText, updatedAtMs: Date.now() }
              })
              return changed ? next : prev
            })

            if (openedPath === createdPath) {
              lastLoadedRef.current = { path: createdPath, text: nextText }
              setActiveText(nextText)
              if (activeDocumentKey) {
                void setActiveMarkdownDocument({ name: activeDocumentKey, text: nextText, normalizeMermaidMmd: false, sourceUrl: fetched.normalizedUrl })
              }
            }

            status.setStatusInfo('Webpage content loaded', { ttlMs: 6000, dismissible: true })
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
