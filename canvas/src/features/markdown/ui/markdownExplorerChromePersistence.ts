import { LS_KEYS } from '@/lib/config'
import {
  getLocalStorage,
  readBoolFromStorage,
  readIntFromStorage,
  writeBoolToStorage,
  writeIntToStorage,
} from '@/lib/persistence'

export type MarkdownExplorerChromeState = {
  sidebarWidthPx: number
  explorerOpen: boolean
}

export type MarkdownExplorerChromePersistenceArgs = {
  minWidthPx: number
  maxWidthPx: number
  defaultWidthPx: number
  defaultExplorerOpen?: boolean
  storage?: Storage | null
}

function normalizeMarkdownExplorerSidebarWidthPx(
  widthPx: number,
  args: Pick<MarkdownExplorerChromePersistenceArgs, 'minWidthPx' | 'maxWidthPx' | 'defaultWidthPx'>,
): number {
  const minWidthPx = Math.max(1, Math.floor(args.minWidthPx))
  const maxWidthPx = Math.max(minWidthPx, Math.floor(args.maxWidthPx))
  const fallbackWidthPx = Number.isFinite(args.defaultWidthPx) ? Math.floor(args.defaultWidthPx) : minWidthPx
  const candidateWidthPx = Number.isFinite(widthPx) ? Math.floor(widthPx) : fallbackWidthPx
  return Math.max(minWidthPx, Math.min(maxWidthPx, candidateWidthPx))
}

function readStorage(args: MarkdownExplorerChromePersistenceArgs): Storage | null {
  return typeof args.storage === 'undefined' ? getLocalStorage() : args.storage
}

export function readMarkdownExplorerChromeState(
  args: MarkdownExplorerChromePersistenceArgs,
): MarkdownExplorerChromeState {
  const storage = readStorage(args)
  const defaultExplorerOpen = args.defaultExplorerOpen !== false
  const sidebarWidthPx = normalizeMarkdownExplorerSidebarWidthPx(
    readIntFromStorage(storage, LS_KEYS.markdownSidebarWidthPx, args.defaultWidthPx),
    args,
  )
  const explorerOpen = readBoolFromStorage(storage, LS_KEYS.markdownSidebarOpen, defaultExplorerOpen)
  return {
    sidebarWidthPx,
    explorerOpen,
  }
}

export function persistMarkdownExplorerChromeState(
  state: Partial<MarkdownExplorerChromeState>,
  args: MarkdownExplorerChromePersistenceArgs,
): MarkdownExplorerChromeState {
  const storage = readStorage(args)
  const current = readMarkdownExplorerChromeState({ ...args, storage })
  const next: MarkdownExplorerChromeState = {
    sidebarWidthPx: normalizeMarkdownExplorerSidebarWidthPx(
      typeof state.sidebarWidthPx === 'number' ? state.sidebarWidthPx : current.sidebarWidthPx,
      args,
    ),
    explorerOpen: typeof state.explorerOpen === 'boolean' ? state.explorerOpen : current.explorerOpen,
  }
  writeIntToStorage(storage, LS_KEYS.markdownSidebarWidthPx, next.sidebarWidthPx, {
    min: args.minWidthPx,
    max: args.maxWidthPx,
  })
  writeBoolToStorage(storage, LS_KEYS.markdownSidebarOpen, next.explorerOpen)
  return next
}
