import React from 'react'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { isInitializationWorkspacePath } from '@/features/workspace-fs/workspaceFs'
import {
  extractYamlFrontmatterBlock,
  normalizeWebpageFrontmatterView,
  parseWebpageFrontmatterMeta,
  readYamlFrontmatterValue,
  upsertWebpageFrontmatterMeta,
} from '@/lib/markdown/frontmatter'
import { WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { fetchWorkspaceUrlContent } from '../workspaceImport'
import { loadWorkspaceSourceIndex, removeWorkspaceEntrySourcesForPrefix, setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { UseWorkspaceFileActionsArgs } from './types'

export function useWorkspaceMutationActions(args: {
  core: { status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers> }
  ctx: Pick<
    UseWorkspaceFileActionsArgs,
    | 'getFs'
    | 'refresh'
    | 'openedPath'
    | 'selectionPath'
    | 'selectionEntryKind'
    | 'activeDocumentKey'
    | 'setActiveText'
    | 'setEntries'
    | 'lastLoadedRef'
    | 'setActiveMarkdownDocument'
    | 'setActivePathSafe'
    | 'setSelectionPathSafe'
  >
}) {
  const { status } = args.core
  const {
    getFs,
    refresh,
    openedPath,
    selectionPath,
    selectionEntryKind,
    activeDocumentKey,
    setActiveText,
    setEntries,
    lastLoadedRef,
    setActiveMarkdownDocument,
    setActivePathSafe,
    setSelectionPathSafe,
  } = args.ctx

  const refreshFileFromSource = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      const index = loadWorkspaceSourceIndex()
      const src = index[normalized]
      if (!src || src.kind !== 'url' || !String(src.url || '').trim()) {
        status.setStatusError('No URL source')
        return
      }
      status.setStatusProgress('Refreshing')
      try {
        const fs = await getFs()
        const prevText = await fs.readFileText(normalized).catch(() => '')
        const prevFm = prevText ? extractYamlFrontmatterBlock(prevText) : null
        const prevMeta = prevText ? parseWebpageFrontmatterMeta(prevText) : null
        const prevViewRaw = prevFm ? readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageView') : ''
        const prevHasImages = !!(prevFm && readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageIncludeImages'))
        const prevHasFidelity = !!(prevFm && readYamlFrontmatterValue(prevFm.rawBlock, 'kgWebpageFidelityLevel'))

        const desiredView = prevViewRaw === 'html' ? 'html' : prevViewRaw === 'json' ? 'json' : prevViewRaw === 'markdown' ? 'markdown' : ''
        const viewHint = desiredView === 'markdown' ? 'markdown' : desiredView === 'json' ? 'json' : desiredView === 'html' ? 'html' : undefined

        const fetched = await fetchWorkspaceUrlContent(src.url, {
          mode: 'refresh',
          viewHint,
          onProgress: p => status.setStatusProgress('Refreshing', p, 100),
        })
        let nextText = fetched.text
        if (prevMeta && prevMeta.url) {
          if (desiredView) nextText = normalizeWebpageFrontmatterView(nextText, desiredView as 'html' | 'json' | 'markdown')
          if (prevHasImages || prevHasFidelity || prevMeta.siteRootRel) {
            nextText = upsertWebpageFrontmatterMeta(nextText, {
              url: prevMeta.url,
              view: desiredView === 'json' ? 'json' : desiredView === 'html' ? 'html' : 'markdown',
              siteRootRel: prevMeta.siteRootRel,
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
          if (activeDocumentKey) {
            void setActiveMarkdownDocument({ name: activeDocumentKey, text: nextText, normalizeMermaidMmd: false, sourceUrl: fetched.normalizedUrl })
          }
        }
        status.setStatusInfo('Refreshed')
      } catch (e) {
        status.setStatusError(`Refresh failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, getFs, lastLoadedRef, openedPath, setActiveMarkdownDocument, setActiveText, setEntries, status],
  )

  const deleteEntry = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      if (isInitializationWorkspacePath(normalized)) {
        status.setStatusError('Delete disabled for initialization file')
        return
      }
      status.setStatusProgress('Deleting')
      try {
        const fs = await getFs()
        await fs.deleteEntry(normalized)
        removeWorkspaceEntrySourcesForPrefix(normalized)
        await refresh()
        status.setStatusInfo('Deleted')
      } catch (e) {
        status.setStatusError(`Delete failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [getFs, refresh, status],
  )

  const renameEntry = React.useCallback(
    async (path: WorkspacePath, nextNameRaw: string) => {
      const sourcePath = normalizeWorkspacePath(path)
      const nextName = String(nextNameRaw || '').trim()
      if (!sourcePath || sourcePath === WORKSPACE_ROOT_PATH) return
      if (!nextName || nextName.includes('/') || nextName.includes('\\')) {
        status.setStatusError('Invalid name')
        return
      }
      status.setStatusProgress('Renaming')
      try {
        const fs = await getFs()
        const list = await fs.listEntries()
        const target = list.find(e => normalizeWorkspacePath(e.path) === sourcePath)
        if (!target) {
          status.setStatusError('Path not found')
          return
        }
        const parentPath = normalizeWorkspacePath(target.parentPath || WORKSPACE_ROOT_PATH)
        const nextPath = normalizeWorkspacePath(`${parentPath === WORKSPACE_ROOT_PATH ? '' : parentPath}/${nextName}`)
        if (nextPath === sourcePath) {
          status.setStatusInfo('Unchanged')
          return
        }
        if (list.some(e => normalizeWorkspacePath(e.path) === nextPath)) {
          status.setStatusError('Name already exists')
          return
        }

        const sourceIndex = loadWorkspaceSourceIndex()
        const sourcePrefix = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`
        const nextPrefix = nextPath.endsWith('/') ? nextPath : `${nextPath}/`

        if (target.kind === 'file') {
          const text = String((await fs.readFileText(sourcePath)) || '')
          await fs.createFile({ parentPath, name: nextName, text })
        } else {
          await fs.createFolder({ parentPath, name: nextName })
          const descendants = list
            .filter(e => normalizeWorkspacePath(e.path).startsWith(sourcePrefix))
            .sort((a, b) => normalizeWorkspacePath(a.path).length - normalizeWorkspacePath(b.path).length)
          for (const entry of descendants) {
            const oldPath = normalizeWorkspacePath(entry.path)
            const rel = oldPath.slice(sourcePrefix.length)
            const mapped = normalizeWorkspacePath(`${nextPrefix}${rel}`)
            const mappedParent = normalizeWorkspacePath(entry.parentPath ? `${nextPath}/${normalizeWorkspacePath(entry.parentPath).slice(sourcePath.length + 1)}` : nextPath)
            if (entry.kind === 'folder') {
              await fs.createFolder({ parentPath: mappedParent, name: normalizeWorkspacePath(mapped).split('/').pop() || 'folder' })
            } else {
              const text = String((await fs.readFileText(oldPath)) || '')
              await fs.createFile({ parentPath: mappedParent, name: normalizeWorkspacePath(mapped).split('/').pop() || 'file.md', text })
            }
          }
        }

        await fs.deleteEntry(sourcePath)
        removeWorkspaceEntrySourcesForPrefix(sourcePath)
        const applySourceMove = (fromPath: WorkspacePath, toPath: WorkspacePath) => {
          const src = sourceIndex[normalizeWorkspacePath(fromPath)]
          if (!src) return
          setWorkspaceEntrySource(toPath, src)
        }
        applySourceMove(sourcePath, nextPath)
        for (const [k] of Object.entries(sourceIndex)) {
          const normalized = normalizeWorkspacePath(k)
          if (!normalized.startsWith(sourcePrefix)) continue
          const rel = normalized.slice(sourcePrefix.length)
          applySourceMove(normalized, normalizeWorkspacePath(`${nextPrefix}${rel}`))
        }

        if (selectionPath && normalizeWorkspacePath(selectionPath).startsWith(sourcePrefix)) {
          const rel = normalizeWorkspacePath(selectionPath).slice(sourcePrefix.length)
          setSelectionPathSafe(normalizeWorkspacePath(`${nextPrefix}${rel}`))
        } else if (selectionPath && normalizeWorkspacePath(selectionPath) === sourcePath) {
          setSelectionPathSafe(nextPath)
        }
        const remappedOpenedPath = (() => {
          if (!openedPath) return null
          const normalizedOpened = normalizeWorkspacePath(openedPath)
          if (normalizedOpened === sourcePath) return nextPath
          if (normalizedOpened.startsWith(sourcePrefix)) {
            const rel = normalizedOpened.slice(sourcePrefix.length)
            return normalizeWorkspacePath(`${nextPrefix}${rel}`)
          }
          return null
        })()
        if (remappedOpenedPath) {
          setActivePathSafe(remappedOpenedPath)
          const latestText = String((await fs.readFileText(remappedOpenedPath)) || '')
          lastLoadedRef.current = { path: remappedOpenedPath, text: latestText }
          setActiveText(latestText)
          const nextDocumentKey = workspaceDocumentKey(remappedOpenedPath)
          if (nextDocumentKey || activeDocumentKey) {
            void setActiveMarkdownDocument({
              name: nextDocumentKey || activeDocumentKey,
              text: latestText,
              normalizeMermaidMmd: false,
              sourceUrl: null,
            })
          }
        }

        await refresh()
        status.setStatusInfo('Renamed')
      } catch (e) {
        status.setStatusError(`Rename failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activeDocumentKey,
      getFs,
      lastLoadedRef,
      openedPath,
      refresh,
      selectionPath,
      setActiveMarkdownDocument,
      setActivePathSafe,
      setActiveText,
      setSelectionPathSafe,
      status,
    ],
  )

  const clearFile = React.useCallback(
    async (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      status.setStatusProgress('Clearing')
      try {
        const fs = await getFs()
        await fs.writeFileText(normalized, '')
        lastLoadedRef.current = { path: normalized, text: '' }
        setEntries(prev => prev.map(e => (e.path === normalized ? { ...e, text: '', updatedAtMs: Date.now() } : e)))
        if (openedPath === normalized) {
          setActiveText('')
          if (activeDocumentKey) {
            void setActiveMarkdownDocument({ name: activeDocumentKey, text: '', normalizeMermaidMmd: false, sourceUrl: null })
          }
        }
        status.setStatusInfo('Cleared')
      } catch (e) {
        status.setStatusError(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, getFs, lastLoadedRef, openedPath, setActiveMarkdownDocument, setActiveText, setEntries, status],
  )

  const clearFolder = React.useCallback(
    async (folderPath: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(folderPath)
      if (!normalized || normalized === WORKSPACE_ROOT_PATH) return
      const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`
      status.setStatusProgress('Clearing')
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
          if (activeDocumentKey) {
            void setActiveMarkdownDocument({ name: activeDocumentKey, text: '', normalizeMermaidMmd: false, sourceUrl: null })
          }
        } else {
          const last = lastLoadedRef.current
          if (last && targetSet.has(last.path)) {
            lastLoadedRef.current = { path: last.path, text: '' }
          }
        }

        if (targets.length > 0) {
          setEntries(prev => prev.map(e => (targetSet.has(e.path) ? { ...e, text: '', updatedAtMs: Date.now() } : e)))
        }
        status.setStatusInfo(targets.length > 0 ? `Cleared ${targets.length} files` : 'Cleared')
      } catch (e) {
        status.setStatusError(`Clear failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activeDocumentKey, getFs, lastLoadedRef, openedPath, setActiveMarkdownDocument, setActiveText, setEntries, status],
  )

  const canClearActiveSelection = !!(
    selectionPath && (selectionEntryKind === 'file' || (selectionEntryKind === 'folder' && selectionPath !== WORKSPACE_ROOT_PATH))
  )
  const canDeleteActive = !!selectionPath && selectionPath !== WORKSPACE_ROOT_PATH && !isInitializationWorkspacePath(selectionPath)

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

  const onRenameEntry = React.useCallback((path: WorkspacePath, nextName: string) => {
    void renameEntry(path, nextName)
  }, [renameEntry])

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
    refreshFileFromSource,
    onDeleteEntry,
    onRenameEntry,
    onClearFile,
    canClearActiveSelection,
    canDeleteActive,
    onClearActiveSelection,
    onDeleteActive,
  }
}
