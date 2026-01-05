import {
  ORCHESTRATOR_TRAVERSAL_TOOLTIP,
  GRAPH_DATA_TABLE_CURATION_TOOLTIP,
  TOOL_MENU_PARSER_DESCRIPTION,
  TOOL_MENU_SCHEMA_CONFIG_DESCRIPTION,
  TOOL_MENU_GRAPH_FIELDS_DESCRIPTION,
  TOOL_MENU_RENDER_DESCRIPTION,
  TOOL_MENU_SETTINGS_DESCRIPTION,
  TOOL_MENU_HISTORY_DESCRIPTION,
  TOOL_MENU_VALIDATION_DESCRIPTION,
} from '@/lib/config'

export type ToolMenuAction = 'new' | 'import' | 'importLocal' | 'importUrl' | 'export' | 'clear'

export type ToolMenuArea =
  | 'curator'
  | 'validation'
  | 'markdown'
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

const TOOL_MENU_MARKDOWN_DESCRIPTION =
  'Import or export Markdown (.md) documents for AgenticRAG-aligned document graphs.'

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
    key: 'curator',
    label: 'Graph Data Table',
    description: GRAPH_DATA_TABLE_CURATION_TOOLTIP,
    actions: ['new', 'import', 'export', 'clear'],
  },
  {
    key: 'validation',
    label: 'Validation',
    description: TOOL_MENU_VALIDATION_DESCRIPTION,
    actions: ['export'],
  },
  {
    key: 'markdown',
    label: 'Markdown',
    description: TOOL_MENU_MARKDOWN_DESCRIPTION,
    actions: ['import', 'export'],
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
