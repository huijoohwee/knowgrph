import {
  ORCHESTRATOR_TRAVERSAL_TOOLTIP,
  TOOL_MENU_SOURCE_FILES_DESCRIPTION,
  TOOL_MENU_PARSER_DESCRIPTION,
  TOOL_MENU_SCHEMA_CONFIG_DESCRIPTION,
  TOOL_MENU_GRAPH_FIELDS_DESCRIPTION,
  TOOL_MENU_RENDER_DESCRIPTION,
  TOOL_MENU_SETTINGS_DESCRIPTION,
  TOOL_MENU_HISTORY_DESCRIPTION,
  TOOL_MENU_VALIDATION_DESCRIPTION,
} from '@/lib/config'

export type ToolMenuAction = 'new' | 'import' | 'importLocal' | 'importUrl' | 'export' | 'clear'

export type ToolMenuPayload = {
  url?: string
  format?: 'markdown' | 'html' | 'pdf' | 'youtube' | 'jsonld' | 'json' | 'csv'
}

export type ToolMenuArea =
  | 'sourceFiles'
  | 'validation'
  | 'markdown'
  | 'html'
  | 'pdf'
  | 'parser'
  | 'schemaConfig'
  | 'graphFields'
  | 'orchestrator'
  | 'render'
  | 'settings'
  | 'history'

export interface ToolMenuAreaConfig {
  key: ToolMenuArea
  label: string
  description: string
  actions: ToolMenuAction[]
}

export const TOOL_MENU_ACTION_LABELS: Record<ToolMenuAction, string> = {
  new: 'New',
  import: 'Import',
  importLocal: 'Import (Local)',
  importUrl: 'Import (URL)',
  export: 'Export',
  clear: 'Clear',
}

export const TOOL_MENU_AREAS: ToolMenuAreaConfig[] = [
  {
    key: 'sourceFiles',
    label: 'Source Files',
    description: TOOL_MENU_SOURCE_FILES_DESCRIPTION,
    actions: ['new', 'import', 'export', 'clear'],
  },
  {
    key: 'validation',
    label: 'Validation',
    description: TOOL_MENU_VALIDATION_DESCRIPTION,
    actions: ['export'],
  },
  {
    key: 'parser',
    label: 'Parser',
    description: TOOL_MENU_PARSER_DESCRIPTION,
    actions: ['new', 'import', 'export', 'clear'],
  },
  {
    key: 'schemaConfig',
    label: 'Schema Configurator (Graph Fields)',
    description: TOOL_MENU_SCHEMA_CONFIG_DESCRIPTION,
    actions: ['import', 'export'],
  },
  {
    key: 'graphFields',
    label: 'Graph Fields',
    description: TOOL_MENU_GRAPH_FIELDS_DESCRIPTION,
    actions: ['import', 'export'],
  },
  {
    key: 'orchestrator',
    label: 'Orchestrator',
    description: ORCHESTRATOR_TRAVERSAL_TOOLTIP,
    actions: ['new', 'import', 'export', 'clear'],
  },
  {
    key: 'render',
    label: 'Renderer',
    description: TOOL_MENU_RENDER_DESCRIPTION,
    actions: ['import', 'export'],
  },
  {
    key: 'settings',
    label: 'Settings',
    description: TOOL_MENU_SETTINGS_DESCRIPTION,
    actions: ['import', 'export'],
  },
  {
    key: 'history',
    label: 'History',
    description: TOOL_MENU_HISTORY_DESCRIPTION,
    actions: ['import', 'export'],
  },
]
