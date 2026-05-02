import { LS_KEYS } from '@/lib/config'
import {
  getLocalStorage,
  readJsonFromStorage,
  writeJsonToStorage,
} from '@/lib/persistence'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import type { FolderModeContract } from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared'

export type MarkdownExplorerModePreferences = {
  folderModeContract: FolderModeContract
  layoutMode: MarkdownWorkspaceLayoutMode
}

const DEFAULT_MARKDOWN_EXPLORER_MODE_PREFERENCES: MarkdownExplorerModePreferences = {
  folderModeContract: 'sitemap',
  layoutMode: 'split',
}

function parseFolderModeContract(value: unknown): FolderModeContract | null {
  return value === 'user-journey' ? 'user-journey' : value === 'sitemap' ? 'sitemap' : null
}

export function readMarkdownExplorerModePreferences(
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerModePreferences {
  return {
    folderModeContract: readJsonFromStorage(
      storage,
      LS_KEYS.markdownExplorerFolderModeContract,
      DEFAULT_MARKDOWN_EXPLORER_MODE_PREFERENCES.folderModeContract,
      parseFolderModeContract,
    ),
    layoutMode: readJsonFromStorage(
      storage,
      LS_KEYS.markdownLayoutMode,
      DEFAULT_MARKDOWN_EXPLORER_MODE_PREFERENCES.layoutMode,
      value => parseMarkdownWorkspaceLayoutMode(value),
    ),
  }
}

export function persistMarkdownExplorerModePreferences(
  preferences: Partial<MarkdownExplorerModePreferences>,
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerModePreferences {
  const current = readMarkdownExplorerModePreferences(storage)
  const next: MarkdownExplorerModePreferences = {
    folderModeContract:
      typeof preferences.folderModeContract === 'string'
        ? parseFolderModeContract(preferences.folderModeContract) ?? current.folderModeContract
        : current.folderModeContract,
    layoutMode:
      typeof preferences.layoutMode === 'string'
        ? parseMarkdownWorkspaceLayoutMode(preferences.layoutMode)
        : current.layoutMode,
  }
  writeJsonToStorage(storage, LS_KEYS.markdownExplorerFolderModeContract, next.folderModeContract)
  writeJsonToStorage(storage, LS_KEYS.markdownLayoutMode, next.layoutMode)
  return next
}
