import { UI_COPY, UI_LABELS } from '@/lib/config'

export type MainPanelTabKey =
  | 'integrations'
  | 'mcp'
  | 'maps'
  | 'payments'
  | 'workflowManager'
  | 'help'
  | 'dashboard'
  | 'preview'
  | 'settings'
  | 'history'

export function isMainPanelTabKey(key: string): key is MainPanelTabKey {
  return (
    key === 'integrations' ||
    key === 'mcp' ||
    key === 'maps' ||
    key === 'payments' ||
    key === 'workflowManager' ||
    key === 'help' ||
    key === 'dashboard' ||
    key === 'preview' ||
    key === 'settings' ||
    key === 'history'
  )
}

export const SEARCHABLE_MAIN_PANEL_TABS = new Set<MainPanelTabKey>([
  'integrations',
  'mcp',
  'maps',
  'payments',
  'help',
  'settings',
  'history',
  'workflowManager',
])

export const MAIN_PANEL_TABS: Array<{ key: MainPanelTabKey; label: string }> = [
  { key: 'integrations', label: UI_LABELS.integrations },
  { key: 'mcp', label: UI_LABELS.mcp },
  { key: 'maps', label: UI_LABELS.maps },
  { key: 'payments', label: UI_LABELS.payments },
  { key: 'workflowManager', label: UI_LABELS.workflowManager },
  { key: 'dashboard', label: UI_LABELS.dashboard },
  { key: 'preview', label: UI_LABELS.previewPanel },
  { key: 'settings', label: UI_LABELS.settings },
  { key: 'history', label: UI_LABELS.history },
  { key: 'help', label: UI_LABELS.help },
]

export const MAIN_PANEL_SEARCH_PLACEHOLDER_BY_TAB: Partial<Record<MainPanelTabKey, string>> = {
  integrations: UI_COPY.searchSettingsPlaceholder,
  mcp: UI_COPY.searchSettingsPlaceholder,
  maps: UI_COPY.searchSettingsPlaceholder,
  payments: UI_COPY.searchSettingsPlaceholder,
  help: UI_COPY.searchShortcutsPlaceholder,
  settings: UI_COPY.searchSettingsPlaceholder,
  history: UI_LABELS.search,
  workflowManager: UI_COPY.searchFlowEditorManagerRegistryPlaceholder,
}

export const MAIN_PANEL_FOOTER_LABEL_BY_TAB: Record<MainPanelTabKey, string> = {
  integrations: UI_LABELS.integrations,
  mcp: UI_LABELS.mcp,
  maps: UI_LABELS.maps,
  payments: UI_LABELS.payments,
  workflowManager: UI_LABELS.workflowManager,
  help: UI_LABELS.help,
  dashboard: UI_LABELS.dashboard,
  preview: UI_LABELS.previewPanel,
  settings: UI_LABELS.settings,
  history: UI_LABELS.history,
}
