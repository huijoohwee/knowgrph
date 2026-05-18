import { LS_KEYS } from '@/lib/config'
import {
  readMarkdownExplorerSectionCollapseState,
  requestMarkdownExplorerSourceFilesOpen,
} from '@/features/markdown/ui/useMarkdownExplorerSectionCollapseState'
import { loadSettingsCollapsedByArea, persistSettingsCollapsedByArea } from '@/features/panels/utils/settingsCollapsedStorage'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testSettingsViewCollapsePersistence() {
  if (LS_KEYS.settingsCollapsedByArea !== 'kg:settings:collapsedByArea') {
    throw new Error('settingsCollapsedByArea key mismatch')
  }
  const storage = new MemoryStorage()
  const initial = loadSettingsCollapsedByArea(storage)
  if (Object.keys(initial).length !== 0) {
    throw new Error('initial collapsedByArea should be empty')
  }
  const next = { 'Area A': true, 'Area B': false }
  persistSettingsCollapsedByArea(storage, next)
  const loaded = loadSettingsCollapsedByArea(storage)
  const keys = Object.keys(loaded)
  if (keys.length !== 2 || !keys.includes('Area A') || !keys.includes('Area B')) {
    throw new Error('collapsedByArea keys not round-tripped')
  }
  if (loaded['Area A'] !== true || loaded['Area B'] !== false) {
    throw new Error('collapsedByArea values not round-tripped')
  }
}

export function testMarkdownExplorerSourceFilesOpenRequestPersistsExpandedState() {
  const { restore } = initJsdomHarness()
  try {
    window.localStorage.setItem(LS_KEYS.markdownExplorerSourceFilesCollapsed, 'true')
    requestMarkdownExplorerSourceFilesOpen()
    const next = readMarkdownExplorerSectionCollapseState(window.localStorage)
    if (next.sourceFilesCollapsed !== false) {
      throw new Error('expected Source Files open request to persist expanded Source Files state')
    }
  } finally {
    restore()
  }
}
