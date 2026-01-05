import { LS_KEYS } from '@/lib/config'
import { loadSettingsCollapsedByArea, persistSettingsCollapsedByArea } from '@/features/panels/utils/settingsCollapsedStorage'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

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
