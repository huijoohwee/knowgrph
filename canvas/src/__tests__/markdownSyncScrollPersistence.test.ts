import { LS_KEYS } from '@/lib/config'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { lsBool, lsSetBool } from '@/lib/persistence'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export function testMarkdownSyncScrollPersistence() {
  if (LS_KEYS.markdownSyncScroll !== 'kg:ui:markdown:syncScroll') {
    throw new Error('markdownSyncScroll key mismatch')
  }

  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    let value = lsBool(LS_KEYS.markdownSyncScroll, true)
    if (value !== true) {
      throw new Error('expected true fallback when storage is empty')
    }

    lsSetBool(LS_KEYS.markdownSyncScroll, true)
    value = lsBool(LS_KEYS.markdownSyncScroll, false)
    if (value !== true) {
      throw new Error('expected true after setting true')
    }

    lsSetBool(LS_KEYS.markdownSyncScroll, false)
    value = lsBool(LS_KEYS.markdownSyncScroll, true)
    if (value !== false) {
      throw new Error('expected false after setting false')
    }

    storage.setItem(LS_KEYS.markdownSyncScroll, 'other')
    value = lsBool(LS_KEYS.markdownSyncScroll, true)
    if (value !== false) {
      throw new Error('expected false for invalid value')
    }
  } finally {
    restore()
  }
}
