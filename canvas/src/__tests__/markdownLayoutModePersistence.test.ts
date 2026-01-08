import { LS_KEYS } from '@/lib/config'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export function testMarkdownLayoutModePersistence() {
  if (LS_KEYS.markdownLayoutMode !== 'kg:ui:markdown:layoutMode') {
    throw new Error('markdownLayoutMode key mismatch')
  }

  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    lsSetJson<'split' | 'editor' | 'viewer'>(
      LS_KEYS.markdownLayoutMode,
      'editor',
    )
    let mode = lsJson<'split' | 'editor' | 'viewer'>(
      LS_KEYS.markdownLayoutMode,
      'split',
      value =>
        value === 'editor' || value === 'viewer' || value === 'split'
          ? value
          : 'split',
    )
    if (mode !== 'editor') {
      throw new Error('expected editor after setting editor')
    }

    lsSetJson<'split' | 'editor' | 'viewer'>(
      LS_KEYS.markdownLayoutMode,
      'viewer',
    )
    mode = lsJson<'split' | 'editor' | 'viewer'>(
      LS_KEYS.markdownLayoutMode,
      'split',
      value =>
        value === 'editor' || value === 'viewer' || value === 'split'
          ? value
          : 'split',
    )
    if (mode !== 'viewer') {
      throw new Error('expected viewer after setting viewer')
    }

    storage.setItem(LS_KEYS.markdownLayoutMode, 'other')
    mode = lsJson<'split' | 'editor' | 'viewer'>(
      LS_KEYS.markdownLayoutMode,
      'split',
      value =>
        value === 'editor' || value === 'viewer' || value === 'split'
          ? value
          : 'split',
    )
    if (mode !== 'split') {
      throw new Error('expected split fallback for invalid value')
    }
  } finally {
    restore()
  }
}
