import type { ParserSpec } from '@/features/parsers'
import type { Action } from '@/features/panels/ui/ActionsRowModel'
import { exportCustomParsersToFile, importCustomParsersFromText } from '@/features/parsers/io'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'

export function buildSchemaActions(onImportSchema: () => void, onExportSchema: () => void): Action[] {
  return [
    { label: 'Import', onClick: onImportSchema },
    { label: 'Export', onClick: onExportSchema },
  ]
}

export function normalizeParserMetadata(spec: ParserSpec | null): { base?: string; match?: { mode?: string; value?: string }; transforms?: { nodeTypeDefault?: string; edgeLabelDefault?: string } } {
  if (!spec) return {}
  const rec = (spec && typeof spec === 'object') ? (spec as Record<string, unknown>) : {}
  const base = typeof rec.base === 'string' ? rec.base : undefined
  const matchMeta = rec.match
  const match = (matchMeta && typeof matchMeta === 'object') ? (() => {
    const m = matchMeta as Record<string, unknown>
    const mode = typeof m.mode === 'string' ? m.mode : undefined
    const value = typeof m.value === 'string' ? m.value : undefined
    return mode && value ? { mode, value } : undefined
  })() : undefined
  const transformsMeta = rec.transforms
  const transforms = (transformsMeta && typeof transformsMeta === 'object') ? (() => {
    const t = transformsMeta as Record<string, unknown>
    const nodeTypeDefault = typeof t.nodeTypeDefault === 'string' ? t.nodeTypeDefault : undefined
    const edgeLabelDefault = typeof t.edgeLabelDefault === 'string' ? t.edgeLabelDefault : undefined
    return { nodeTypeDefault, edgeLabelDefault }
  })() : undefined
  return { base, match, transforms }
}

export function formatCounts(counts: { n: number; e: number }): string {
  return `Nodes: ${counts.n} · Edges: ${counts.e}`
}

export function firstWarningText(warnings: string[]): string | null {
  return (warnings && warnings.length > 0) ? warnings[0] : null
}

export function getCustomParserDefaults(cfg: unknown): {
  id: string
  name: string
  base: 'csv'|'json'|'jsonld'|'n8n'
  matchMode: 'endsWith'|'contains'|'regex'
  matchValue: string
  nodeTypeDefault: string
  edgeLabelDefault: string
  extraTransformsJson: string
} {
  const rec = (cfg && typeof cfg === 'object') ? (cfg as Record<string, unknown>) : {}
  const id = typeof rec.id === 'string' ? rec.id : ''
  const name = typeof rec.name === 'string' ? rec.name : ''
  const baseStr = typeof rec.base === 'string' ? rec.base : 'csv'
  const isBase = (v: unknown): v is 'csv'|'json'|'jsonld'|'n8n' => typeof v === 'string' && (v === 'csv' || v === 'json' || v === 'jsonld' || v === 'n8n')
  const base = isBase(baseStr) ? baseStr : 'csv'
  const matchRec = (rec.match && typeof rec.match === 'object') ? (rec.match as Record<string, unknown>) : {}
  const modeStr = typeof matchRec.mode === 'string' ? matchRec.mode : 'endsWith'
  const isMode = (v: unknown): v is 'endsWith'|'contains'|'regex' => typeof v === 'string' && (v === 'endsWith' || v === 'contains' || v === 'regex')
  const matchMode = isMode(modeStr) ? modeStr : 'endsWith'
  const matchValue = typeof matchRec.value === 'string' ? matchRec.value : ''
  const defaults = (rec.transforms && typeof rec.transforms === 'object') ? (rec.transforms as Record<string, unknown>) : {}
  const nodeTypeDefault = typeof defaults.nodeTypeDefault === 'string' ? defaults.nodeTypeDefault : ''
  const edgeLabelDefault = typeof defaults.edgeLabelDefault === 'string' ? defaults.edgeLabelDefault : ''
  const extraKeys = Object.keys(defaults).filter(k => k !== 'nodeTypeDefault' && k !== 'edgeLabelDefault')
  const extra: Record<string, unknown> = {}
  for (const k of extraKeys) { extra[k] = (defaults as Record<string, unknown>)[k] }
  let extraTransformsJson = '{}'
  try { extraTransformsJson = JSON.stringify(extra || {}, null, 2) } catch { void 0 }
  return { id, name, base, matchMode, matchValue, nodeTypeDefault, edgeLabelDefault, extraTransformsJson }
}

export function noParserMatchMessage(attemptedAutoDetect: boolean, inputText: string): string | null {
  if (!attemptedAutoDetect) return null
  if (!inputText) return null
  return UI_COPY.parserNoMatchMessage
}

export async function exportParsers(): Promise<void> {
  await exportCustomParsersToFile()
}

type ImportParserResult =
  | { kind: 'cancelled' }
  | { kind: 'script'; name: string; language: 'json' | 'yaml' | 'text' }
  | { kind: 'parsers'; name: string; imported: number; errors: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isCustomParserConfigLike = (v: unknown): boolean => {
  if (!isRecord(v)) return false
  const { id, name, base, match } = v
  if (typeof id !== 'string' || typeof name !== 'string' || typeof base !== 'string') return false
  if (!isRecord(match)) return false
  return true
}

const looksLikeCustomParsersJson = (parsed: unknown): boolean => {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return false
    return parsed.every(isCustomParserConfigLike)
  }
  return isCustomParserConfigLike(parsed)
}

export async function importParser(): Promise<ImportParserResult> {
  const f = await pickTextFileWithExtensions(['.py', '.yaml', '.yml', '.json'])
  if (!f) return { kind: 'cancelled' }
  const name = f.name || ''
  const lower = name.toLowerCase()

  if (lower.endsWith('.py')) {
    try {
      const ui = useParserUIState.getState()
      ui.setScriptText(f.text)
      ui.setPreferredLanguage('text')
      ui.setParserLoadStatus(true, name || UI_COPY.parserDataLoadSuccess)
    } catch {
      void 0
    }
    return { kind: 'script', name, language: 'text' }
  }

  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    try {
      const ui = useParserUIState.getState()
      ui.setScriptText(f.text)
      ui.setPreferredLanguage('yaml')
      ui.setParserLoadStatus(true, name || UI_COPY.parserDataLoadSuccess)
    } catch {
      void 0
    }
    return { kind: 'script', name, language: 'yaml' }
  }

  if (lower.endsWith('.json')) {
    try {
      const parsed = JSON.parse(f.text) as unknown
      if (looksLikeCustomParsersJson(parsed)) {
        const res = await importCustomParsersFromText(f.text)
        const imported = typeof res.imported === 'number' ? res.imported : 0
        const errors = Array.isArray(res.errors) ? res.errors : []
        const parts: string[] = []
        parts.push(imported === 1 ? 'Imported 1 parser.' : `Imported ${imported} parsers.`)
        if (errors.length > 0) parts.push(`Errors: ${errors.join('; ')}`)
        const msg = parts.join(' ')
        try {
          useParserUIState.getState().setParserLoadStatus(errors.length > 0 ? false : true, msg)
        } catch {
          void 0
        }
        try {
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(msg)
          }
        } catch {
          void 0
        }
        return { kind: 'parsers', name, imported, errors }
      }
    } catch {
      void 0
    }
    try {
      const ui = useParserUIState.getState()
      ui.setScriptText(f.text)
      ui.setPreferredLanguage('json')
      ui.setParserLoadStatus(true, name || 'Success')
    } catch {
      void 0
    }
    return { kind: 'script', name, language: 'json' }
  }

  try {
    useParserUIState.getState().setParserLoadStatus(false, 'Unsupported file type. Expected .py, .yaml, .yml or .json')
  } catch {
    void 0
  }
  return { kind: 'cancelled' }
}

export function resetParserUiState(): void {
  try {
    const ui = useParserUIState.getState()
    ui.reset()
    ui.setScriptText('')
    ui.setParserLoadStatus(null, '')
  } catch {
    void 0
  }
}

export function formatStatusItems(spec: ParserSpec | null, inputName: string, counts?: { n: number; e: number } | null): string[] {
  const items: string[] = []
  const name = spec ? (spec.name || spec.id) : ''
  if (name) items.push(name)
  const iname = (inputName || '').trim()
  if (iname) items.push(iname)
  if (counts && typeof counts.n === 'number' && counts.n > 0) items.push(`${counts.n} nodes`)
  if (counts && typeof counts.e === 'number' && counts.e > 0) items.push(`${counts.e} edges`)
  return items
}
