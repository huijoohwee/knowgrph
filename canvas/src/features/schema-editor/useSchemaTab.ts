import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { GraphSchema, defaultSchema } from '@/lib/graph/schema'
import { toSchemaConfigPath } from '@/lib/graph/file'
import { computeFilteredLists } from '@/features/schema-editor/utils'
import { importSchemaFromFileIntoStore, exportSchemaAsJSON, parseSchemaText } from '@/features/schema/io'
import { lintSchemaMetadata, validateSchema } from '@/features/schema/validation'
import type { Action } from '@/features/panels/ui/ActionsRowModel'
import { UI_COPY } from '@/lib/config'
import { stringifyCanonicalSchema } from '@/features/schema/schemaCanonical'

export function computeSchemaTabEnterText(tab: string, previousText: string, schema: GraphSchema | null): string | null {
  if (tab !== 'schema') return null
  if (previousText.trim().length > 0) return null
  try {
    return JSON.stringify(schema ?? defaultSchema, null, 2)
  } catch {
    return null
  }
}

export function useSchemaTab(tab: string) {
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const setSchemaImportLabel = useGraphStore(s => s.setSchemaImportLabel)
  const schemaImportLabel = useGraphStore(s => s.schemaImportLabel)
  const setSchemaOpStatus = useGraphStore(s => s.setSchemaOpStatus)
  const schemaLastExportHash = useGraphStore(s => s.schemaLastExportHash)
  const setSchemaLastExportSnapshot = useGraphStore(s => s.setSchemaLastExportSnapshot)
  const setSchemaLintSummary = useGraphStore(s => s.setSchemaLintSummary)
  const clearSchemaLintSummary = useGraphStore(s => s.clearSchemaLintSummary)
  const data = useGraphStore(s => s.graphData)

  const [schemaText, setSchemaTextState] = useState('')
  const schemaTextRef = useRef<string>('')
  const setSchemaText = useCallback((next: string) => {
    schemaTextRef.current = next
    setSchemaTextState(next)
  }, [])
  const [schemaError, setSchemaError] = useState('')

  useEffect(() => {
    try {
      setSchemaText(JSON.stringify(schema, null, 2))
      setSchemaError('')
    } catch {
      void 0
    }
  }, [schema, setSchemaText])

  useEffect(() => {
    if (tab !== 'schema') return
    if (schemaText.trim().length > 0) return
    const next = computeSchemaTabEnterText(tab, schemaText, schema)
    if (!next) return
    setSchemaText(next)
    setSchemaError('')
  }, [tab, schema, schemaText, setSchemaText])

  const schemaHash = useMemo(() => {
    try {
      return stringifyCanonicalSchema(schema)
    } catch {
      return ''
    }
  }, [schema])

  const schemaUnsaved = schemaLastExportHash !== null && schemaLastExportHash !== schemaHash

  const onApplySchema = useCallback(() => {
    try {
      const nextSchema = parseSchemaText(schemaTextRef.current) as GraphSchema
      setSchema(nextSchema)
      setSchemaError('')
      setSchemaOpStatus(true, 'Apply OK')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSchemaError(`${UI_COPY.invalidSchemaPrefix}${msg}`)
      setSchemaOpStatus(false, 'Apply failed')
    }
  }, [setSchema, setSchemaOpStatus])

  const onResetSchema = useCallback(() => {
    setSchema(defaultSchema)
    setSchemaText(JSON.stringify(defaultSchema, null, 2))
    setSchemaError('')
    setSchemaImportLabel(null)
    setSchemaLastExportSnapshot(null)
    setSchemaOpStatus(true, 'Reset')
  }, [setSchema, setSchemaImportLabel, setSchemaLastExportSnapshot, setSchemaOpStatus, setSchemaText])

  const onImportSchema = useCallback(async () => {
    clearSchemaLintSummary()
    setSchemaError('')
    await importSchemaFromFileIntoStore({
      setSchemaText,
    })
  }, [clearSchemaLintSummary, setSchemaError, setSchemaText])

  const onExportSchema = useCallback(async () => {
    try {
      const schemaToExport = validateSchema(schema)
      const suggestedRaw = (() => {
        const label = typeof schemaImportLabel === 'string' ? schemaImportLabel.trim() : ''
        if (label) {
          return label.startsWith('schema-config/') ? label : `schema-config/${label}`
        }
        return 'schema-config/knowgrph-universal-schema-config.jsonld'
      })()

      setSchemaError('')
      setSchemaOpStatus(null, 'Exporting...')
      const ok = await exportSchemaAsJSON(schemaToExport, toSchemaConfigPath(suggestedRaw))
      setSchemaOpStatus(ok, ok ? 'Export OK' : 'Export failed')
      if (ok) {
        try {
          const lint = lintSchemaMetadata(schemaToExport)
          setSchemaLintSummary(lint.length, lint[0] ? lint[0].path : null, lint.slice(0, 5).map(w => w.path))
        } catch {
          void 0
        }
        setSchemaLastExportSnapshot(schemaToExport)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSchemaError(`${UI_COPY.invalidJsonPrefix}${msg}`)
      setSchemaOpStatus(false, 'Export failed')
    }
  }, [schema, schemaImportLabel, setSchemaLastExportSnapshot, setSchemaLintSummary, setSchemaOpStatus])

  const schemaActions = useMemo<Action[]>(
    () => [
      { label: 'Import JSON', onClick: onImportSchema },
      { label: 'Export JSON', onClick: onExportSchema },
    ],
    [onImportSchema, onExportSchema],
  )

  const schemaLists = useMemo(
    () => computeFilteredLists(data ?? null, schema, ''),
    [data, schema],
  )

  return {
    schema,
    setSchema,
    schemaText,
    setSchemaText,
    schemaError,
    onImportSchema,
    setSchemaError,
    onApplySchema,
    onResetSchema,
    schemaActions,
    schemaLastExportHash,
    schemaHash,
    schemaUnsaved,
    uniqueNodeTypes: schemaLists.uniqueNodeTypes,
    uniqueEdgeLabels: schemaLists.uniqueEdgeLabels,
    filteredNodeTypes: schemaLists.filteredNodeTypes,
    filteredEdgeLabels: schemaLists.filteredEdgeLabels,
  }
}
