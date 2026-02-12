import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiImportWebpageSettingsRegistry: SettingMeta[] = [
  {
    key: 'webpageImportIncludeImages',
    type: 'boolean',
    source: 'store',
    read: () => s().webpageImportIncludeImages,
    write: v => s().setWebpageImportIncludeImages(!!v),
    docKey: 'webpageImportIncludeImages',
    default: () => true,
  },
  {
    key: 'webpageImportView',
    type: 'string',
    source: 'store',
    read: () => s().webpageImportView,
    write: v =>
      s().setWebpageImportView(
        String(v) === 'html' ? 'html' : String(v) === 'json' ? 'json' : 'markdown',
      ),
    docKey: 'webpageImportView',
    default: () => 'markdown',
    options: ['markdown', 'json', 'html'],
  },
]
