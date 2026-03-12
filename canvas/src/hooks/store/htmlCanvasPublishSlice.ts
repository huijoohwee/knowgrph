import type { StateCreator } from 'zustand'
import type { GraphState } from './types'
import { LS_KEYS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'

const normalizePublishPath = (raw: string): string => {
  const p = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!p) return 'index.html'
  const parts = p.split('/').filter(Boolean)
  if (parts.some(x => x === '..')) return 'index.html'
  return parts.join('/')
}

const readInitialPublishPath = (): string => {
  const storage = getLocalStorage()
  if (!storage) return 'index.html'
  try {
    const v = String(storage.getItem(LS_KEYS.exportHtmlCanvasPublishPath) || '').trim()
    return normalizePublishPath(v)
  } catch {
    return 'index.html'
  }
}

export type HtmlCanvasPublishSlice = {
  htmlCanvasPublishFolderHandle: FileSystemDirectoryHandle | null
  htmlCanvasPublishFolderName: string | null
  htmlCanvasPublishFileHandle: import('@/lib/graph/save').SaveFilePickerHandle | null
  htmlCanvasPublishFileName: string | null
  htmlCanvasPublishPath: string
  setHtmlCanvasPublishFolder: (handle: FileSystemDirectoryHandle | null, folderName?: string | null) => void
  setHtmlCanvasPublishFile: (handle: import('@/lib/graph/save').SaveFilePickerHandle | null, fileName?: string | null) => void
  setHtmlCanvasPublishPath: (path: string) => void
  clearHtmlCanvasPublishTarget: () => void
}

export const createHtmlCanvasPublishSlice: StateCreator<GraphState, [], [], HtmlCanvasPublishSlice> = (set) => ({
  htmlCanvasPublishFolderHandle: null,
  htmlCanvasPublishFolderName: null,
  htmlCanvasPublishFileHandle: null,
  htmlCanvasPublishFileName: null,
  htmlCanvasPublishPath: readInitialPublishPath(),
  setHtmlCanvasPublishFolder: (handle, folderName) => {
    const name =
      typeof folderName === 'string'
        ? String(folderName || '').trim() || null
        : handle
          ? String(handle.name || '').trim() || null
          : null
    set(() => ({
      htmlCanvasPublishFolderHandle: handle || null,
      htmlCanvasPublishFolderName: handle ? name : null,
      htmlCanvasPublishFileHandle: null,
      htmlCanvasPublishFileName: null,
    }))
  },
  setHtmlCanvasPublishFile: (handle, fileName) => {
    const name = typeof fileName === 'string' ? String(fileName || '').trim() || null : null
    set(() => ({
      htmlCanvasPublishFolderHandle: null,
      htmlCanvasPublishFolderName: null,
      htmlCanvasPublishFileHandle: handle || null,
      htmlCanvasPublishFileName: handle ? name : null,
    }))
  },
  setHtmlCanvasPublishPath: (path) => {
    const next = normalizePublishPath(String(path || ''))
    set(() => ({ htmlCanvasPublishPath: next }))
    const storage = getLocalStorage()
    if (!storage) return
    try {
      storage.setItem(LS_KEYS.exportHtmlCanvasPublishPath, next)
    } catch {
      void 0
    }
  },
  clearHtmlCanvasPublishTarget: () => {
    set(() => ({
      htmlCanvasPublishFolderHandle: null,
      htmlCanvasPublishFolderName: null,
      htmlCanvasPublishFileHandle: null,
      htmlCanvasPublishFileName: null,
    }))
  },
})
