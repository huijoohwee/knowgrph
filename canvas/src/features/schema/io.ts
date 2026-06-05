import { GraphSchema } from '@/lib/graph/schema'
import { readExportPrefs, writeExportPrefs, saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import {
  DEFAULT_SCHEMA_CONFIG_PATH,
  normalizeSchemaConfigPath,
  SCHEMA_CONFIG_PATH_PREFIX,
  pickTextFileWithExtensions,
} from '@/lib/graph/file'
import { validateSchema, lintSchemaMetadata } from '@/features/schema/validation'
import { schemaToJsonLd, schemaFromJsonLd } from '@/features/schema/schemaJsonLd'
import { exportSchemaAsCSV } from '@/features/schema/schemaCsv'
import { useGraphStore } from '@/hooks/useGraphStore'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function looksLikeJsonLdSchemaDocument(value: unknown): boolean {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i]
      if (!isRecord(item)) continue
      if ('@id' in item || '@type' in item) return true
    }
    return false
  }
  if (isRecord(value)) {
    const graph = value['@graph']
    if (Array.isArray(graph)) return true
    if ('@id' in value || '@type' in value) return true
  }
  return false
}

function parseSchemaValue(value: unknown): GraphSchema {
  if (looksLikeJsonLdSchemaDocument(value)) {
    try {
      return validateSchema(schemaFromJsonLd(value))
    } catch {
      void 0
    }
  }
  return validateSchema(value as Partial<GraphSchema>)
}

export function parseSchemaText(text: string): GraphSchema {
  const parsed = JSON.parse(text) as unknown
  return parseSchemaValue(parsed)
}

export type LoadSchemaFromFileResult =
  | { ok: true; schema: GraphSchema; label: string }
  | { ok: false; reason: 'cancel' | 'invalid' | 'error' }

export async function loadSchemaFromFile(): Promise<LoadSchemaFromFileResult> {
  try {
    const picked = await pickTextFileWithExtensions(['.json', '.jsonld', '.json-ld'])
    if (!picked) return { ok: false, reason: 'cancel' }
    try {
      const schema = parseSchemaText(picked.text)
      return { ok: true, schema, label: picked.name }
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  } catch (err) {
    const reason = (() => {
      const value = err as { name?: unknown } | null | undefined
      const name = value && typeof value.name === 'string' ? value.name : ''
      if (name === 'AbortError') return 'cancel' as const
      return 'error' as const
    })()
    return { ok: false, reason }
  }
}

export async function importSchemaFromFileIntoStore(
  opts?: { setSchemaText?: (text: string) => void },
): Promise<void> {
  try {
    const loaded = await loadSchemaFromFile()
    const store = useGraphStore.getState()
    if (loaded.ok) {
      try {
        store.clearSchemaLintSummary()
      } catch {
        void 0
      }
      try {
        store.setSchema(loaded.schema)
      } catch {
        void 0
      }
      if (opts && typeof opts.setSchemaText === 'function') {
        try {
          opts.setSchemaText(JSON.stringify(loaded.schema, null, 2))
        } catch {
          void 0
        }
      }
      try {
        store.setSchemaImportLabel(loaded.label)
      } catch {
        void 0
      }
      try {
        store.setSchemaLastExportSnapshot(null)
      } catch {
        void 0
      }
      try {
        store.setSchemaOpStatus(true, `Import OK: ${loaded.label}`)
      } catch {
        void 0
      }
      return
    }
    const errorResult = loaded as { ok: false; reason: 'cancel' | 'invalid' | 'error' }
    if (errorResult.reason === 'cancel') {
      try {
        store.setSchemaOpStatus(null, IMPORT_EXPORT_STATUS_COPY.importCancelled)
      } catch {
        void 0
      }
      return
    }
    const msg = errorResult.reason === 'invalid'
      ? IMPORT_EXPORT_STATUS_COPY.schemaImportInvalidJson
      : IMPORT_EXPORT_STATUS_COPY.schemaImportFailed
    try {
      store.setSchemaOpStatus(false, msg)
    } catch {
      void 0
    }
  } catch {
    try {
      useGraphStore.getState().setSchemaOpStatus(false, IMPORT_EXPORT_STATUS_COPY.schemaImportFailed)
    } catch {
      void 0
    }
  }
}

export async function exportSchemaAsJSON(
  schema: GraphSchema,
  suggested?: import('@/lib/graph/file').SchemaConfigPath,
): Promise<boolean> {
  try {
    const lint = lintSchemaMetadata(schema)
    try {
      const store = useGraphStore.getState()
      store.setSchemaLintSummary(lint.length, lint[0] ? lint[0].path : null)
    } catch {
      void 0
    }
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
    const prefs = readExportPrefs()
    const filenamePref = typeof (prefs as Record<string, unknown>).filename === 'string' ? (prefs as Record<string, unknown>).filename as string : undefined
    const formatPref = typeof (prefs as Record<string, unknown>).format === 'string' ? (prefs as Record<string, unknown>).format as string : undefined
    const raw = (() => {
      if (suggested) return String(suggested)
      if (filenamePref && formatPref === 'schema-json') return filenamePref
      return String(DEFAULT_SCHEMA_CONFIG_PATH)
    })()
    const withPrefix = String(normalizeSchemaConfigPath(raw))
    const lowered = withPrefix.toLowerCase()
    const name = lowered.endsWith('.json') || lowered.endsWith('.jsonld') || lowered.endsWith('.json-ld')
      ? withPrefix
      : `${withPrefix}.json`
    const saved = await saveBlobWithPicker(blob, name, {
      description: 'JSON Files',
      accept: { 'application/json': ['.json', '.jsonld', '.json-ld'] },
    })
    if (saved === '') return false
    if (saved) {
      writeExportPrefs({ format: 'schema-json', filename: saved })
      return true
    }
    downloadBlob(blob, name)
    return true
  } catch {
    return false
  }
}

export async function exportSchemaAsJsonLd(
  schema: GraphSchema,
  suggested?: import('@/lib/graph/file').SchemaConfigPath,
): Promise<boolean> {
  try {
    const lint = lintSchemaMetadata(schema)
    try {
      const store = useGraphStore.getState()
      store.setSchemaLintSummary(lint.length, lint[0] ? lint[0].path : null)
    } catch {
      void 0
    }
    const obj = schemaToJsonLd(schema)
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/ld+json' })
    const prefs = readExportPrefs()
    const filenamePref = typeof (prefs as Record<string, unknown>).filename === 'string' ? (prefs as Record<string, unknown>).filename as string : undefined
    const formatPref = typeof (prefs as Record<string, unknown>).format === 'string' ? (prefs as Record<string, unknown>).format as string : undefined
    const raw = (() => {
      if (suggested) return String(suggested)
      if (filenamePref && formatPref === 'schema-jsonld') return filenamePref
      return String(DEFAULT_SCHEMA_CONFIG_PATH)
    })()
    const prefixed = String(normalizeSchemaConfigPath(raw))
    const lowered = prefixed.toLowerCase()
    const name = (lowered.endsWith('.jsonld') || lowered.endsWith('.json') || lowered.endsWith('.json-ld'))
      ? prefixed
      : `${prefixed}.jsonld`
    const saved = await saveBlobWithPicker(blob, name, { description: 'JSON-LD Files', accept: { 'application/ld+json': ['.jsonld', '.json'] } })
    if (saved === '') return false
    if (saved) {
      writeExportPrefs({ format: 'schema-jsonld', filename: saved })
      return true
    }
    downloadBlob(blob, name)
    return true
  } catch {
    return false
  }
}

export async function exportSchemaAsCsv(
  schema: GraphSchema,
  suggested?: import('@/lib/graph/file').SchemaConfigPath,
): Promise<boolean> {
  try {
    const lint = lintSchemaMetadata(schema)
    try {
      const store = useGraphStore.getState()
      store.setSchemaLintSummary(lint.length, lint[0] ? lint[0].path : null)
    } catch {
      void 0
    }
    const csv = exportSchemaAsCSV(schema)
    const blob = new Blob([csv], { type: 'text/csv' })
    const prefs = readExportPrefs()
    const filenamePref = typeof (prefs as Record<string, unknown>).filename === 'string' ? (prefs as Record<string, unknown>).filename as string : undefined
    const formatPref = typeof (prefs as Record<string, unknown>).format === 'string' ? (prefs as Record<string, unknown>).format as string : undefined
    const raw = suggested ? String(suggested) : (filenamePref && formatPref === 'schema-csv' ? filenamePref : 'schema.csv')
    const prefixed = raw.startsWith(SCHEMA_CONFIG_PATH_PREFIX) ? raw : 'schema.csv'
    const lowered = prefixed.toLowerCase()
    const name = lowered.endsWith('.csv') ? prefixed : 'schema.csv'
    const saved = await saveBlobWithPicker(blob, name, { description: 'CSV Files', accept: { 'text/csv': ['.csv'] } })
    if (saved === '') return false
    if (saved) {
      writeExportPrefs({ format: 'schema-csv', filename: saved })
      return true
    }
    downloadBlob(blob, 'schema.csv')
    return true
  } catch {
    return false
  }
}

export async function copySchemaJsonToClipboard(schema: GraphSchema | null): Promise<boolean> {
  try {
    if (!schema) return false
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false
    const text = JSON.stringify(schema, null, 2)
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export async function copySchemaJsonLdToClipboard(schema: GraphSchema | null): Promise<boolean> {
  try {
    if (!schema) return false
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false
    const obj = schemaToJsonLd(schema)
    const text = JSON.stringify(obj, null, 2)
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
