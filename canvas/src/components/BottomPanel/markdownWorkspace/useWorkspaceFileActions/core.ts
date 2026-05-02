import React from 'react'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import {
  WORKSPACE_ROOT_PATH,
  ancestorPathsForWorkspacePath,
  normalizeWorkspacePath,
  workspaceDocumentKey,
} from '@/features/workspace-fs/path'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY, UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { parsePdfWorkspaceFrontmatter } from '@/lib/pdf/pdfWorkspaceFrontmatter'
import { fetchPdfWorkspaceDoc } from '@/lib/pdf/pdfWorkspaceClient'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'
import { buildMarkdownWorkspaceRestoredActiveDocumentArgs } from '@/lib/markdown-workspace-runtime/markdownWorkspaceActiveDocumentRestore'
import type { StatusHelpers, UseWorkspaceFileActionsArgs } from './types'
import type { MarkdownWorkspaceStatus } from '../markdownWorkspaceTypes'
import { formatMarkdownWorkspaceStatusLabel } from '../markdownWorkspaceStatusUi'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { runWorkspaceFsChangedBatch, suppressNextWorkspaceFsChangedEvent } from '@/features/workspace-fs/workspaceFsEvents'

const DEFAULT_WORKSPACE_STATUS_TOAST_ID = 'markdown-workspace-status'

const lastToastSigById = new Map<string, string>()

const shouldSkipToast = (id: string, sig: string): boolean => {
  const prev = lastToastSigById.get(id)
  if (prev === sig) return true
  lastToastSigById.set(id, sig)
  return false
}

export function shouldForceDocumentSemanticModeForImport(nameForParse: string): boolean {
  const lower = String(nameForParse || '').trim().toLowerCase()
  if (!lower) return false
  if (isMarkdownLikeFileName(lower)) return false
  return (
    lower.endsWith('.json') ||
    lower.endsWith('.jsonld') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.geojson') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml')
  )
}

export function useWorkspaceStatusHelpers(opts?: { toastId?: string }): StatusHelpers {
  const toastId = String(opts?.toastId || DEFAULT_WORKSPACE_STATUS_TOAST_ID).trim() || DEFAULT_WORKSPACE_STATUS_TOAST_ID

  const buildWebpageImportStageLabel = React.useCallback((pctRaw: number): string => {
    const pct = Math.max(0, Math.min(100, Math.floor(Number.isFinite(pctRaw) ? pctRaw : 0)))
    if (pct < 20) return 'Fetching webpage HTML'
    if (pct < 60) return 'Processing webpage DOM'
    if (pct < 90) return 'Converting webpage to Markdown'
    return 'Finalizing webpage document'
  }, [])

  const emitToast = React.useCallback(
    (args: { kind: 'neutral' | 'success' | 'warning' | 'error'; message: string; ttlMs?: number | null; dismissible?: boolean; log?: boolean }) => {
      const message = String(args.message || '').trim()
      if (!message) return
      const kind = args.kind
      const ttlMs = typeof args.ttlMs === 'undefined' ? UI_TOAST_TTL_MS.statusAutoClose : args.ttlMs
      const dismissible = typeof args.dismissible === 'boolean' ? args.dismissible : kind === 'error'
      const sig = `${kind}|${ttlMs ?? 'null'}|${dismissible ? '1' : '0'}|${message}`
      if (shouldSkipToast(toastId, sig)) return
      try {
        useGraphStore.getState().upsertUiToast({
          id: toastId,
          kind,
          message,
          ttlMs,
          dismissible,
          log: args.log === true,
        })
      } catch {
        void 0
      }
    },
    [toastId],
  )

  const setStatusInfo = React.useCallback(
    (label: string, statusOpts?: { ttlMs?: number | null; dismissible?: boolean }) => {
      const msg = String(label || '').trim()
      if (!msg) return
      emitToast({
        kind: 'neutral',
        message: msg,
        ttlMs: statusOpts?.ttlMs,
        dismissible: typeof statusOpts?.dismissible === 'boolean' ? statusOpts.dismissible : true,
      })
    },
    [emitToast],
  )

  const setStatusError = React.useCallback(
    (label: string, statusOpts?: { ttlMs?: number | null; dismissible?: boolean }) => {
      const msg = String(label || '').trim()
      if (!msg) return
      emitToast({
        kind: 'error',
        message: msg,
        ttlMs: typeof statusOpts?.ttlMs === 'undefined' ? null : statusOpts.ttlMs,
        dismissible: typeof statusOpts?.dismissible === 'boolean' ? statusOpts.dismissible : true,
        log: true,
      })
    },
    [emitToast],
  )

  const setStatusWarning = React.useCallback(
    (label: string, statusOpts?: { ttlMs?: number | null; dismissible?: boolean }) => {
      const msg = String(label || '').trim()
      if (!msg) return
      emitToast({
        kind: 'warning',
        message: msg,
        ttlMs: statusOpts?.ttlMs,
        dismissible: typeof statusOpts?.dismissible === 'boolean' ? statusOpts.dismissible : true,
      })
    },
    [emitToast],
  )

  const setStatusProgress = React.useCallback(
    (
      label: string,
      current?: number | null,
      total?: number | null,
      bytesCurrent?: number | null,
      bytesTotal?: number | null,
      statusOpts?: { ttlMs?: number | null },
    ) => {
      const msg = String(label || '').trim()
      if (!msg) return
      const status: MarkdownWorkspaceStatus = {
        kind: 'progress',
        label: msg,
        current: typeof current === 'number' ? current : null,
        total: typeof total === 'number' ? total : null,
        bytesCurrent: typeof bytesCurrent === 'number' ? bytesCurrent : null,
        bytesTotal: typeof bytesTotal === 'number' ? bytesTotal : null,
      }
      emitToast({
        kind: 'neutral',
        message: formatMarkdownWorkspaceStatusLabel(status),
        ttlMs: typeof statusOpts?.ttlMs === 'undefined' ? null : statusOpts.ttlMs,
        dismissible: true,
      })
    },
    [emitToast],
  )

  const clearStatus = React.useCallback(() => {
    try {
      useGraphStore.getState().dismissUiToast(toastId)
    } catch {
      void 0
    }
    lastToastSigById.delete(toastId)
  }, [toastId])

  return { setStatusInfo, setStatusWarning, setStatusError, setStatusProgress, clearStatus, buildWebpageImportStageLabel }
}

export function useWorkspaceFileActionsCore(args: UseWorkspaceFileActionsArgs): {
  importJobRef: React.MutableRefObject<number>
  status: StatusHelpers
  focusAfterImport: (createdPath: WorkspacePath, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
  createNewFile: (opts?: { parentPath?: WorkspacePath }) => Promise<void>
  createNewFolder: (opts?: { parentPath?: WorkspacePath }) => Promise<void>
} {
  const {
    getFs,
    refresh,
    setExpandedPaths,
    setActivePathSafe,
    setSelectionPathSafe,
    activeDocumentSourceUrl,
    setActiveText,
    lastLoadedRef,
    setActiveMarkdownDocument,
    applyMarkdownDocumentToGraph,
  } = args

  const importJobRef = React.useRef(0)
  const status = useWorkspaceStatusHelpers()

  const applyImportedTextToGraph = React.useCallback(
    async (inner: { nameForParse: string; text: string }) => {
      const storeBefore = useGraphStore.getState()
      const resolvedText = await (async (): Promise<string> => {
        const meta = parsePdfWorkspaceFrontmatter(inner.text)
        if (!meta) return inner.text
        try {
          const controller = new AbortController()
          const timeoutMs = 1500
          const t = setTimeout(() => controller.abort(), timeoutMs)
          const fetched = await fetchPdfWorkspaceDoc({ docId: meta.docId, outputDirRel: meta.outputDirRel, signal: controller.signal }).finally(() => clearTimeout(t))
          if (fetched.ok !== true) return inner.text
          const markdown = String(fetched.markdown || '')
          return markdown.trim() ? markdown : inner.text
        } catch {
          return inner.text
        }
      })()

      const okMarkdown = await applyMarkdownDocumentToGraph(inner.nameForParse, resolvedText, { force: true })
      if (!okMarkdown) {
        const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
        await loadGraphDataFromTextViaParser(inner.nameForParse, resolvedText, { applyToStore: true })
      }

      const store = useGraphStore.getState()
      const baselineLocked = store.documentStructureBaselineLock === true
      const graphData = store.graphData
      const hasAnyGraph = !!(graphData && (((graphData.nodes || []).length > 0) || ((graphData.edges || []).length > 0)))
      if (!hasAnyGraph) return

      if (!baselineLocked && shouldForceDocumentSemanticModeForImport(inner.nameForParse)) {
        store.setDocumentSemanticMode('document')
      }

      const meta = (graphData?.metadata || {}) as Record<string, unknown>
      const hasWidgetRegistry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY])
        ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as unknown[]).length > 0
        : false

      if (hasWidgetRegistry) {
        if (baselineLocked) {
          status.setStatusWarning(UI_COPY.baselineLockedToast, { ttlMs: UI_TOAST_TTL_MS.warningExtended, dismissible: true })
          return
        }
        const schema = store.schema
        if (schema) {
          const { enableHandlesForAllInputsInSchema } = (await import('@/lib/flowEditor/flowEditorActions')) as typeof import('@/lib/flowEditor/flowEditorActions')
          const res = enableHandlesForAllInputsInSchema(schema)
          if (res.changed) store.setSchema(res.schema)
        }
        store.setCanvasRenderMode('2d')
        store.setCanvas2dRenderer('flowEditor')
        store.setWorkspaceViewMode('canvas')
        return
      }
    },
    [applyMarkdownDocumentToGraph, status],
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
      try {
        const fs = await getFs()
        const text = await fs.readFileText(createdPath)
        if (opts?.jobId != null && importJobRef.current !== opts.jobId) return
        const docKey = workspaceDocumentKey(createdPath)
        const content = String(text || '')
        lastLoadedRef.current = { path: createdPath, text: content }
        setActiveText(content)
        const restoredActiveDocumentArgs = buildMarkdownWorkspaceRestoredActiveDocumentArgs({
          activeDocumentKey: docKey,
          text: content,
          activeDocumentSourceUrl: typeof opts?.sourceUrl === 'string' ? opts.sourceUrl : activeDocumentSourceUrl,
        })
        if (restoredActiveDocumentArgs && content.trim()) {
          void applyActiveMarkdownDocumentPayload({
            setActiveMarkdownDocument,
            ...restoredActiveDocumentArgs,
          })
          if (opts?.applyToGraph) {
            await applyImportedTextToGraph({ nameForParse: restoredActiveDocumentArgs.name, text: content })
          }
        }
      } catch (e) {
        if (opts?.applyToGraph) {
          status.setStatusError(`Apply failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        } else {
          status.setStatusError(`Open failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        }
      }
    },
    [
      activeDocumentSourceUrl,
      applyImportedTextToGraph,
      getFs,
      lastLoadedRef,
      setActiveMarkdownDocument,
      setActivePathSafe,
      setActiveText,
      setExpandedPaths,
      setSelectionPathSafe,
      status,
    ],
  )

  const createNewFile = React.useCallback(
    async (opts?: { parentPath?: WorkspacePath }) => {
      status.setStatusProgress('Creating')
      try {
        const fs = await getFs()
        const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
        const path = await runWorkspaceFsChangedBatch(async () => {
          suppressNextWorkspaceFsChangedEvent()
          return await fs.createFile({ parentPath, name: 'note.md', text: '' })
        })
        setWorkspaceEntrySource(path, { kind: 'local', originalName: null })
        await refresh()
        setActivePathSafe(path)
        setSelectionPathSafe(path)
        status.setStatusInfo('Created')
      } catch (e) {
        status.setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, setActivePathSafe, setSelectionPathSafe, status],
  )

  const createNewFolder = React.useCallback(
    async (opts?: { parentPath?: WorkspacePath }) => {
      status.setStatusProgress('Creating')
      try {
        const fs = await getFs()
        const parentPath = opts?.parentPath ? normalizeWorkspacePath(opts.parentPath) : WORKSPACE_ROOT_PATH
        const path = await runWorkspaceFsChangedBatch(async () => {
          suppressNextWorkspaceFsChangedEvent()
          return await fs.createFolder({ parentPath, name: 'folder' })
        })
        setExpandedPaths(prev => new Set(prev).add(path))
        await refresh()
        setSelectionPathSafe(path)
        status.setStatusInfo('Created')
      } catch (e) {
        status.setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, setExpandedPaths, setSelectionPathSafe, status],
  )

  return { importJobRef, status, focusAfterImport, createNewFile, createNewFolder }
}
