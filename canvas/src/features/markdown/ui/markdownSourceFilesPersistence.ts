import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { parseStringArray } from '@/lib/persistence.parsers'
import { listPersistedMarkdownSourceFolderPaths } from './markdownSourceFileTree'

export function readPersistedMarkdownSourceFolderPaths(storage: Storage | null = getLocalStorage()): string[] {
  const storedPaths = readJsonFromStorage<string[]>(
    storage,
    LS_KEYS.markdownExplorerSourceFilesExpandedPaths,
    [],
    parseStringArray,
  )
  return listPersistedMarkdownSourceFolderPaths(storedPaths)
}

export function persistMarkdownSourceFolderPaths(
  expandedPaths: Iterable<string>,
  storage: Storage | null = getLocalStorage(),
): string[] {
  const persistedPaths = listPersistedMarkdownSourceFolderPaths(expandedPaths)
  writeJsonToStorage(storage, LS_KEYS.markdownExplorerSourceFilesExpandedPaths, persistedPaths)
  return persistedPaths
}
