import type { StateCreator } from 'zustand'
import type { GraphState } from './types'

export type LocalMarkdownFolderSlice = {
  localMarkdownFolderHandle: FileSystemDirectoryHandle | null
  localMarkdownFolderName: string | null
  localMarkdownFolderAccessMode: 'fs-access' | 'opfs' | 'file-input' | null
  localMarkdownFolderCacheId: string | null
  localMarkdownSelectedFolderPath: string | null
  setLocalMarkdownFolderHandle: (
    handle: FileSystemDirectoryHandle | null,
    opts?: { accessMode?: 'fs-access' | 'opfs'; name?: string | null },
  ) => void
  setLocalMarkdownFolderCachedMetadata: (meta: {
    name: string | null
    accessMode: 'fs-access' | 'opfs' | 'file-input' | null
  }) => void
  setLocalMarkdownFolderCacheId: (cacheId: string | null, folderName?: string | null) => void
  setLocalMarkdownSelectedFolderPath: (path: string | null) => void
  clearLocalMarkdownFolder: () => void
}

export const createLocalMarkdownFolderSlice: StateCreator<GraphState, [], [], LocalMarkdownFolderSlice> = (set) => ({
  localMarkdownFolderHandle: null,
  localMarkdownFolderName: null,
  localMarkdownFolderAccessMode: null,
  localMarkdownFolderCacheId: null,
  localMarkdownSelectedFolderPath: null,
  setLocalMarkdownFolderHandle: (handle, opts) => {
    const accessMode = opts?.accessMode || 'fs-access'
    const effectiveName =
      typeof opts?.name === 'string' ? String(opts.name || '').trim() || null : handle ? String(handle.name || '').trim() || null : null
    set(() => ({
      localMarkdownFolderHandle: handle || null,
      localMarkdownFolderName: handle ? effectiveName : null,
      localMarkdownFolderAccessMode: handle ? accessMode : null,
      localMarkdownFolderCacheId: null,
    }))
  },
  setLocalMarkdownFolderCachedMetadata: meta => {
    const name = String(meta?.name || '').trim() || null
    const accessMode = meta?.accessMode || null
    set(prev => {
      if (prev.localMarkdownFolderHandle || prev.localMarkdownFolderCacheId) return prev
      return {
        ...prev,
        localMarkdownFolderName: name,
        localMarkdownFolderAccessMode: accessMode,
      }
    })
  },
  setLocalMarkdownFolderCacheId: (cacheId, folderName) => {
    const id = String(cacheId || '').trim() || null
    const name = String(folderName || '').trim() || null
    set(() => ({
      localMarkdownFolderHandle: null,
      localMarkdownFolderName: name,
      localMarkdownFolderAccessMode: id ? 'file-input' : null,
      localMarkdownFolderCacheId: id,
    }))
  },
  setLocalMarkdownSelectedFolderPath: (path) => {
    const next = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
    set(() => ({ localMarkdownSelectedFolderPath: next || null }))
  },
  clearLocalMarkdownFolder: () => {
    set(() => ({
      localMarkdownFolderHandle: null,
      localMarkdownFolderName: null,
      localMarkdownFolderAccessMode: null,
      localMarkdownFolderCacheId: null,
      localMarkdownSelectedFolderPath: null,
    }))
  },
})
