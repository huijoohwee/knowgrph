import type { StateCreator } from 'zustand'
import type { GraphState } from './types'

export type LocalMarkdownFolderSlice = {
  localMarkdownFolderHandle: FileSystemDirectoryHandle | null
  localMarkdownFolderName: string | null
  localMarkdownFolderAccessMode: 'fs-access' | 'opfs' | 'file-input' | null
  localMarkdownFallbackFilesByPath: Map<string, File> | null
  localMarkdownSelectedFolderPath: string | null
  setLocalMarkdownFolderHandle: (
    handle: FileSystemDirectoryHandle | null,
    opts?: { accessMode?: 'fs-access' | 'opfs'; name?: string | null },
  ) => void
  setLocalMarkdownFallbackFilesByPath: (files: Map<string, File> | null, folderName?: string | null) => void
  setLocalMarkdownSelectedFolderPath: (path: string | null) => void
  clearLocalMarkdownFolder: () => void
}

export const createLocalMarkdownFolderSlice: StateCreator<GraphState, [], [], LocalMarkdownFolderSlice> = (set) => ({
  localMarkdownFolderHandle: null,
  localMarkdownFolderName: null,
  localMarkdownFolderAccessMode: null,
  localMarkdownFallbackFilesByPath: null,
  localMarkdownSelectedFolderPath: null,
  setLocalMarkdownFolderHandle: (handle, opts) => {
    const accessMode = opts?.accessMode || 'fs-access'
    const effectiveName =
      typeof opts?.name === 'string' ? String(opts.name || '').trim() || null : handle ? String(handle.name || '').trim() || null : null
    set(() => ({
      localMarkdownFolderHandle: handle || null,
      localMarkdownFolderName: handle ? effectiveName : null,
      localMarkdownFolderAccessMode: handle ? accessMode : null,
      localMarkdownFallbackFilesByPath: null,
    }))
  },
  setLocalMarkdownFallbackFilesByPath: (files, folderName) => {
    const name = String(folderName || '').trim() || null
    set(() => ({
      localMarkdownFolderHandle: null,
      localMarkdownFolderName: name,
      localMarkdownFolderAccessMode: files && files.size > 0 ? 'file-input' : null,
      localMarkdownFallbackFilesByPath: files && files.size > 0 ? files : null,
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
      localMarkdownFallbackFilesByPath: null,
      localMarkdownSelectedFolderPath: null,
    }))
  },
})
