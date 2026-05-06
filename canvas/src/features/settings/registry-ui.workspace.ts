import type { SettingMeta } from './types'
import {
  PRINT_LAYOUT_TOKENS,
  WORKSPACE_LAYOUT_TOKENS,
  readPrintLayoutToken,
  readWorkspaceLayoutToken,
  writePrintLayoutToken,
  writeWorkspaceLayoutToken,
} from '@/lib/workspace/workspaceLayoutSettings'

const workspaceSettings: SettingMeta[] = WORKSPACE_LAYOUT_TOKENS.map(token => ({
  key: token.key,
  type: 'number',
  source: 'localStorage',
  read: () => readWorkspaceLayoutToken(token.key),
  write: value => {
    writeWorkspaceLayoutToken(token.key, Number(value))
  },
  docKey: token.key,
  default: () => token.defaultValue,
}))

const printSettings: SettingMeta[] = PRINT_LAYOUT_TOKENS.map(token => ({
  key: token.key,
  type: 'number',
  source: 'localStorage',
  read: () => readPrintLayoutToken(token.key),
  write: value => {
    writePrintLayoutToken(token.key, Number(value))
  },
  docKey: token.key,
  default: () => token.defaultValue,
}))

export const uiWorkspaceSettingsRegistry: SettingMeta[] = [
  ...workspaceSettings,
  ...printSettings,
]
