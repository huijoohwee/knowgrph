import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'

export const uiMarkdownSettingsRegistry: SettingMeta[] = [
  {
    key: 'markdownWordWrap',
    type: 'boolean',
    source: 'localStorage',
    read: () => lsBool(LS_KEYS.markdownWordWrap, true),
    write: (v) => {
      lsSetBool(LS_KEYS.markdownWordWrap, Boolean(v))
    },
    docKey: 'markdownWordWrap',
    default: () => true,
  },
  {
    key: 'markdownTextHighlight',
    type: 'boolean',
    source: 'localStorage',
    read: () => lsBool(LS_KEYS.markdownTextHighlight, false),
    write: (v) => {
      lsSetBool(LS_KEYS.markdownTextHighlight, Boolean(v))
    },
    docKey: 'markdownTextHighlight',
    default: () => false,
  },
]

