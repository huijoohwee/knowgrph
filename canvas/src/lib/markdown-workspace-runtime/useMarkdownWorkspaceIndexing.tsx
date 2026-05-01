import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import {
  ancestorPathsForWorkspacePath,
  normalizeWorkspacePath,
  workspaceBasename,
  workspaceDocumentKey,
  workspaceExtLower,
  WORKSPACE_ROOT_PATH,
} from '@/features/workspace-fs/path'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { getWorkspaceSeedFiles } from '@/features/workspace-fs/workspaceFs'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  isPendingLocalImportStubText,
  peekPendingWorkspaceLocalImport,
} from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'
import { buildSourceFileLifecycleState, buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { runInIdle } from '@/features/panels/utils/idle'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { tryBuildGeodataGraphDataFromJsonText } from '@/lib/graph/io/geodataJson'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'
import {
  cancelMarkdownWorkspaceIndexStart,
  scheduleMarkdownWorkspaceIndexStart,
} from './markdownWorkspaceRuntime.stateSync'
import {
  findWorkspaceSourceFileByPath,
  resolveWorkspaceDirtyState,
} from './markdownWorkspaceRuntime.shared'
import { pushWorkspaceTextToActiveMarkdownDocument } from './markdownWorkspaceRuntime.io'
import type { MarkdownWorkspaceRuntimeGetFs, MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'

export function useMarkdownWorkspaceIndexing(args: {
  active: boolean
  viewerInlineEditActive: boolean
  contentMode: 'document' | 'widget'
  widgetAvailable: boolean
  activePath: WorkspacePath | null
  activeEntry: WorkspaceEntry | null
  activeEntryKind: string | null
  activeEntryText: string | undefined
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  sourcesByPath: WorkspaceSourceIndex
  getFs: MarkdownWorkspaceRuntimeGetFs
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  activePathRef: React.MutableRefObject<WorkspacePath | null>
  activeTextRef: React.MutableRefObject<string>
  userEditedActiveTextRef: React.MutableRefObject<boolean>
  repairedMissingWorkspaceFilesRef: React.MutableRefObject<Set<WorkspacePath>>
  lastIndexedByPathRef: React.MutableRefObject<Map<WorkspacePath, string>>
  indexJobRef: React.MutableRefObject<number>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  setActiveTextProgrammatic: (text: string) => void
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  setEntries: React.Dispatch<React.SetStateAction<WorkspaceEntry[]>>
  setStatusError: (label: string) => void
  setStatusProgress: (
    label: string,
    value?: number,
    max?: number,
    bytesDone?: number,
    bytesTotal?: number,
    opts?: { ttlMs?: number },
  ) => void
  setStatusWithAutoClear: (label: string, ttlMs?: number) => void
}) {
  React.useEffect(() => {
    if (!args.active || args.viewerInlineEditActive) return
    if (args.contentMode === 'widget' && args.widgetAvailable) return
    const path = args.activePath
    if (!path || !args.activeEntry || args.activeEntryKind === 'folder') return
    if (
      resolveWorkspaceDirtyState({
        path,
        lastLoadedRef: args.lastLoadedRef,
        activeTextRef: args.activeTextRef,
        userEditedActiveTextRef: args.userEditedActiveTextRef,
      })
    ) {
      return
    }

    const scheduledFor = path
    const cachedText = typeof args.activeEntryText === 'string' ? String(args.activeEntryText ?? '') : null
    const source = args.sourcesByPath[path]
    const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    const sourceFileName = workspaceBasename(path) || 'source.md'
    const pendingLocalImport = peekPendingWorkspaceLocalImport(path)
    const indexLabel = pendingLocalImport?.kind === 'pdf' ? 'Indexing PDF' : 'Indexing'
    const bytesTotalHint = pendingLocalImport ? Math.max(0, Number(pendingLocalImport.file?.size || 0)) : null
    const lastLoaded = args.lastLoadedRef.current
    const canTrustEmptyCache = !!(cachedText === '' && lastLoaded && lastLoaded.path === path && lastLoaded.text === '')
    const isPendingStub = cachedText != null && isPendingLocalImportStubText(cachedText)
    const canUseCachedText =
      cachedText != null &&
      (cachedText !== '' || canTrustEmptyCache) &&
      !(pendingLocalImport && (cachedText === '' || isPendingStub))

    let cancelled = false
    scheduleMarkdownWorkspaceIndexStart(() => {
      if (cancelled || args.activePathRef.current !== scheduledFor) return
      void (async () => {
        let loadingLabelTimer: number | null = null
        try {
          try {
            loadingLabelTimer = window.setTimeout(() => {
              if (bytesTotalHint && bytesTotalHint > 0) {
                args.setStatusProgress(indexLabel, 1, 1, 0, bytesTotalHint)
              } else {
                args.setStatusProgress(indexLabel)
              }
            }, 140)
          } catch {
            void 0
          }

          const text = await (async () => {
            if (canUseCachedText) return cachedText as string
            const fs = await args.getFs()
            const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path })
            const loaded = hydrated ? hydrated.text : await fs.readFileText(path)
            if (loaded != null) return loaded

            const normalizedPath = normalizeWorkspacePath(path)
            if (args.repairedMissingWorkspaceFilesRef.current.has(normalizedPath)) return loaded
            args.repairedMissingWorkspaceFilesRef.current.add(normalizedPath)

            const seeds = await getWorkspaceSeedFiles()
            const seed = seeds.find(candidate => normalizeWorkspacePath(candidate.path) === normalizedPath)
            if (!seed) return loaded

            try {
              const parentFolders = ancestorPathsForWorkspacePath(normalizedPath)
              const parentPath = parentFolders[parentFolders.length - 1] || WORKSPACE_ROOT_PATH
              await ensureWorkspaceFolderTreeIfMissing({ folderPath: parentPath, fs })
              await fs.createFile({ parentPath, name: workspaceBasename(normalizedPath) || 'document.md', text: seed.text })
            } catch {
              void 0
            }

            return await fs.readFileText(normalizedPath)
          })()
          if (cancelled || args.activePathRef.current !== scheduledFor) return
          if (text == null) {
            args.setStatusError('Load failed: Missing file contents')
            return
          }

          const rawNext = String(text)
          const sanitized = (() => {
            if (!rawNext) return null
            if (!rawNext.includes('kgWebpageUrl') && !rawNext.includes('data:image/')) return null
            const res = sanitizeImportedMarkdownText(rawNext)
            return res.changed ? res.text : null
          })()
          const nextText = sanitized ?? rawNext
          if (sanitized) {
            try {
              const fs = await args.getFs()
              await fs.writeFileText(path, sanitized)
            } catch {
              void 0
            }
          }

          args.lastLoadedRef.current = { path, text: nextText }
          args.setActiveTextProgrammatic(nextText)
          if (sanitized && canUseCachedText) args.patchWorkspaceEntryInlineText(path, nextText)
          if (!canUseCachedText) {
            const inlineText = nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : undefined
            args.setEntries(prev => {
              const idx = prev.findIndex(entry => entry.path === path)
              if (idx >= 0) {
                const current = prev[idx]
                if (current.kind !== 'file' || current.text === inlineText) return prev
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
          }
          pushWorkspaceTextToActiveMarkdownDocument({
            activeDocumentKey: args.activeDocumentKey,
            activeDocumentSourceUrl: sourceUrl ? sourceUrl : null,
            setActiveMarkdownDocument: args.setActiveMarkdownDocument,
            text: nextText,
          })

          const wasIndexedForPath = (candidatePath: WorkspacePath, textHash: string): boolean => {
            const existing = args.lastIndexedByPathRef.current.get(candidatePath)
            return typeof existing === 'string' && existing === textHash
          }
          const rememberIndexedForPath = (candidatePath: WorkspacePath, textHash: string): void => {
            const map = args.lastIndexedByPathRef.current
            if (map.has(candidatePath)) map.delete(candidatePath)
            map.set(candidatePath, textHash)
            while (map.size > 24) {
              const oldest = map.keys().next().value as WorkspacePath | undefined
              if (!oldest) break
              map.delete(oldest)
            }
          }

          if (args.activeDocumentKey && nextText.trim()) {
            const hash = buildSourceFileParseIdentityHash({
              cacheNamespace: `workspace-import:${path}`,
              name: workspaceDocumentKey(path),
              text: nextText,
            })
            if (!wasIndexedForPath(path, hash)) {
              const ext = workspaceExtLower(path)
              const isCanvasHtmlExport = (() => {
                if (ext !== '.html' && ext !== '.htm') return false
                const sample = nextText.slice(0, 4096)
                const lower = sample.toLowerCase()
                if (!lower.includes('<!doctype html')) return false
                if (!sample.includes('id="kg-root"') && !sample.includes("id='kg-root'")) return false
                if (!sample.includes('#kg-stage') || !sample.includes('#kg-svgwrap')) return false
                return true
              })()
              if (isCanvasHtmlExport) {
                rememberIndexedForPath(path, hash)
                args.setStatusWithAutoClear('Indexed')
                return
              }

              const jobId = ++args.indexJobRef.current
              const isStaleJob = () =>
                cancelled || args.activePathRef.current !== scheduledFor || args.indexJobRef.current !== jobId
              if (bytesTotalHint && bytesTotalHint > 0) args.setStatusProgress(indexLabel, 1, 1, bytesTotalHint, bytesTotalHint)
              else args.setStatusProgress(indexLabel, 1, 1)

              const store = useGraphStore.getState()
              const workspaceSourcePath = `workspace:${path}`
              const inlineSourceText = nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : ''
              let existingWorkspaceSourceFile = findWorkspaceSourceFileByPath(path)
              const fileId = (() => {
                if (existingWorkspaceSourceFile) return existingWorkspaceSourceFile.id
                const id = `ws:${hashStringToHex(workspaceSourcePath)}`
                const url = sourceUrl ? sourceUrl : undefined
                const sourceRecord = url
                  ? ({ kind: 'url', url, path: workspaceSourcePath } as const)
                  : ({ kind: 'local', path: workspaceSourcePath } as const)
                store.addSourceFile(buildSourceFileRecord({
                  id,
                  name: sourceFileName,
                  text: inlineSourceText,
                  enabled: true,
                  source: sourceRecord,
                }))
                existingWorkspaceSourceFile = findWorkspaceSourceFileByPath(path)
                return id
              })()

              if (isStaleJob()) return
              const existing = existingWorkspaceSourceFile || findWorkspaceSourceFileByPath(path)
              const cachedGraph = existing?.parsedGraphData
              const cachedHash = typeof existing?.parsedTextHash === 'string' ? existing.parsedTextHash : ''
              const shouldReuseExistingWorkspaceSourceFile = !!(
                existing &&
                existing.enabled &&
                String(existing?.source?.path || '') === workspaceSourcePath &&
                cachedGraph &&
                cachedHash === hash
              )
              const workspaceSourceAlreadyMaterialized = !!(
                shouldReuseExistingWorkspaceSourceFile &&
                String(existing?.name || '') === sourceFileName &&
                String(existing?.text || '') === inlineSourceText &&
                String(existing?.status || '').toLowerCase() === 'parsed' &&
                existing?.error == null
              )
              const applyComposedFromSourceFiles = async () => {
                if (isStaleJob()) return
                try {
                  const mod = (await import('@/features/source-files/applyComposedGraphFromSourceFiles')) as typeof import('@/features/source-files/applyComposedGraphFromSourceFiles')
                  if (!isStaleJob()) mod.scheduleApplyComposedGraphFromSourceFiles()
                } catch {
                  void 0
                }
              }

              if (workspaceSourceAlreadyMaterialized) {
                await applyComposedFromSourceFiles()
                if (!isStaleJob()) rememberIndexedForPath(path, hash)
                return
              }

              if (shouldReuseExistingWorkspaceSourceFile) {
                if (isStaleJob()) return
                try {
                  store.updateSourceFile(fileId, {
                    name: sourceFileName,
                    text: inlineSourceText,
                    enabled: true,
                    ...buildSourceFileLifecycleState({
                      status: 'parsed',
                      parserId: existing?.parsedParserId,
                      textHash: existing?.parsedTextHash,
                      graphData: existing?.parsedGraphData,
                      previousState: existing,
                      preserveExistingRevision: true,
                    }),
                  })
                } catch {
                  void 0
                }
                await applyComposedFromSourceFiles()
                if (!isStaleJob()) rememberIndexedForPath(path, hash)
                return
              }

              const isGeoCandidate = (() => {
                const lower = String(path || '').toLowerCase()
                return lower.endsWith('.geojson') || lower.endsWith('.json')
              })()
              try {
                store.updateSourceFile(fileId, {
                  name: sourceFileName,
                  text: inlineSourceText,
                  enabled: true,
                  ...buildSourceFileLifecycleState({
                    status: 'loading',
                    previousState: existing,
                    preserveParsedState: true,
                  }),
                })
              } catch {
                void 0
              }

              const geoGraph = isGeoCandidate
                ? await runInIdle(
                    () => {
                      const lowerPath = String(path || '').toLowerCase()
                      const mightBeGeoJson =
                        lowerPath.endsWith('.geojson') ||
                        (lowerPath.endsWith('.json') && /"type"\s*:\s*"FeatureCollection"/i.test(nextText.slice(0, 4096)))
                      if (mightBeGeoJson && nextText.length < 2_000_000) {
                        const normalized = parseGeoJsonFeatureCollectionFromText(nextText)
                        if (normalized) {
                          return buildGraphDataFromFeatureCollection({
                            featureCollection: normalized,
                            sourcePath: path,
                            sourceHash: hash,
                          })
                        }
                      }
                      const geodata = tryBuildGeodataGraphDataFromJsonText({ name: path, text: nextText, maxRecords: 5000 })
                      return geodata ? geodata.graphData : null
                    },
                    { timeoutMs: 650 },
                  )
                : null
              if (isStaleJob()) return

              if (geoGraph) {
                if (isStaleJob()) return
                await maybeAutoEnableGeospatialModeForGraphData({ graphData: geoGraph, openSidePanel: true })
                if (isStaleJob()) return
                try {
                  store.updateSourceFile(fileId, {
                    ...buildSourceFileLifecycleState({
                      status: 'parsed',
                      parserId: geoGraph.context === 'geodata' ? 'geodata' : 'geojson',
                      textHash: hash,
                      graphData: geoGraph,
                    }),
                  })
                } catch {
                  void 0
                }
                await applyComposedFromSourceFiles()
                if (!isStaleJob()) rememberIndexedForPath(path, hash)
                return
              }

              if (cachedGraph && cachedHash === hash) {
                if (isStaleJob()) return
                try {
                  store.updateSourceFile(fileId, {
                    ...buildSourceFileLifecycleState({
                      status: 'parsed',
                      parserId: existing?.parsedParserId,
                      textHash: existing?.parsedTextHash,
                      graphData: existing?.parsedGraphData,
                      previousState: existing,
                      preserveExistingRevision: true,
                    }),
                  })
                } catch {
                  void 0
                }
                await applyComposedFromSourceFiles()
              } else {
                if (isStaleJob()) return
                const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
                let lastStage = ''
                args.setStatusProgress('Parsing')
                const res = await runInIdle(
                  () =>
                    loadGraphDataFromTextViaParser(args.activeDocumentKey, nextText, {
                      applyToStore: false,
                      onProgress: stage => {
                        const s = String(stage || '').trim()
                        if (!s || s === lastStage) return
                        lastStage = s
                        args.setStatusProgress(s)
                      },
                    }),
                  { timeoutMs: 650 },
                )
                if (isStaleJob()) return
                const graphData = res?.graphData || null
                if (graphData) {
                  try {
                    store.updateSourceFile(fileId, {
                      ...buildSourceFileLifecycleState({
                        status: 'parsed',
                        parserId: typeof res?.parserId === 'string' ? res.parserId : undefined,
                        textHash: hash,
                        graphData,
                      }),
                    })
                  } catch {
                    void 0
                  }
                  await applyComposedFromSourceFiles()
                } else if (!isStaleJob()) {
                  try {
                    store.updateSourceFile(fileId, {
                      ...buildSourceFileLifecycleState({
                        status: 'error',
                        error: 'Parser returned empty graph',
                        parserId: typeof res?.parserId === 'string' ? res.parserId : undefined,
                        textHash: hash,
                        graphData: undefined,
                      }),
                    })
                  } catch {
                    void 0
                  }
                }
              }
              if (!isStaleJob()) rememberIndexedForPath(path, hash)
            }
          }

          args.setStatusWithAutoClear('Indexed')
        } catch (e) {
          if (!cancelled && args.activePathRef.current === scheduledFor) {
            args.setStatusError(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
          }
        } finally {
          if (loadingLabelTimer != null) window.clearTimeout(loadingLabelTimer)
        }
      })()
    }, {
      path: scheduledFor,
      sourceUrl,
      sourceFileName,
    })
    return () => {
      cancelled = true
      cancelMarkdownWorkspaceIndexStart()
    }
  }, [
    args.active,
    args.activeDocumentKey,
    args.activeEntry,
    args.activeEntryKind,
    args.activeEntryText,
    args.activePath,
    args.contentMode,
    args.getFs,
    args.patchWorkspaceEntryInlineText,
    args.setActiveMarkdownDocument,
    args.setActiveTextProgrammatic,
    args.setEntries,
    args.setStatusError,
    args.setStatusProgress,
    args.setStatusWithAutoClear,
    args.sourcesByPath,
    args.userEditedActiveTextRef,
    args.viewerInlineEditActive,
    args.widgetAvailable,
  ])
}
