import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { listParsers, registerParser, bestMatch, builtInParsers, readCustomParsers } from '@/features/parsers'
import type { ParserSpec } from '@/features/parsers'
import { toParserSpec } from '@/features/parsers'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { useParserUIState } from '@/features/parsers/uiState'
import { parserSpecTextFromList } from '@/features/parsers/specFormat'
import {
  loadGraphDataViaParser,
  loadGraphDataFromUrlViaParser,
  loadGraphDataFromBackendViaParser,
  loadGraphDataFromTextViaParser,
  type LoaderResult,
} from '@/features/parsers/loader'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { useGraphStore } from '@/hooks/useGraphStore'
import { GraphSchema, defaultSchema } from '@/lib/graph/schema'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { validateSchema } from '@/features/schema/validation'
import type { DatasetPath } from '@/lib/graph/file'
import { saveGraphFile, exportGraphAsJSON, exportGraphAsCombinedCSV, exportGraphAsGraphML, exportGraphAsCypher, readExportPrefsMeta } from '@/lib/graph/file'
import { exportAsCombinedCsvBlob, exportAsCypherBlob, exportAsGraphMlBlob, exportAsJsonLdBlob, exportAsRawJsonBlob } from '@/lib/graph/io/adapter'
import { openSaveFilePickerHandle, writeBlobToFileHandle, writeExportPrefs } from '@/lib/graph/save'
import { EXAMPLES_BY_ID, type ExampleId } from '@/features/parsers/examplesCatalog'
import { LS_KEYS, LS_LEGACY_KEYS, UI_COPY } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import {
  WORKFLOW_PRESETS,
  type WorkflowPresetId,
  type WorkflowPresetStorageLastApplied,
  getWorkflowPresetPipeline,
  loadExampleDatasetTextInBrowser,
  loadExampleSchemaTextInBrowser,
  fileNameFromRepoPath,
  verifyWorkflowPresetStorage,
  writeWorkflowPresetCatalogToStorage,
  writeWorkflowPresetLastAppliedToStorage,
} from '@/features/parsers/workflowPresets'

const ensureExt = (name: string, allowed: string[], fallback: string): string => {
  const s = String(name || '').toLowerCase()
  const ok = allowed.some(ext => s.endsWith(ext))
  return ok ? name : fallback
}

export const exportGraphJsonLdFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const base = suggested ? String(suggested) : 'graph.jsonld'
    const name = ensureExt(base, ['.jsonld', '.json'], 'graph.jsonld')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'JSON-LD Files',
        accept: { 'application/ld+json': ['.jsonld', '.json'] },
      })
      if (handle === '') return
      if (!handle) {
        await saveGraphFile(current, suggested)
        return
      }
      const blob = exportAsJsonLdBlob(current)
      await writeBlobToFileHandle(handle, blob)
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphJsonFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'json' && prefs.filename ? prefs.filename : 'graph.json'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.json'], 'graph.json')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsJSON(current, suggested)
        return
      }
      const blob = exportAsRawJsonBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'json', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphCsvCombinedFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'csv-combined' && prefs.filename ? prefs.filename : 'graph.csv'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.csv'], 'graph.csv')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'CSV Files',
        accept: { 'text/csv': ['.csv'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsCombinedCSV(current, suggested)
        return
      }
      const blob = exportAsCombinedCsvBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'csv-combined', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphMlFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'graphml' && prefs.filename ? prefs.filename : 'graph.graphml'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.graphml', '.xml'], 'graph.graphml')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'GraphML Files',
        accept: { 'application/graphml+xml': ['.graphml', '.xml'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsGraphML(current, suggested)
        return
      }
      const blob = exportAsGraphMlBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'graphml', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportCypherFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'cypher' && prefs.filename ? prefs.filename : 'graph.cypher'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.cypher', '.cql', '.txt'], 'graph.cypher')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'Cypher Files',
        accept: { 'text/plain': ['.cypher', '.cql', '.txt'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsCypher(current, suggested)
        return
      }
      const blob = exportAsCypherBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'cypher', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export function useParserWorkflowState() {
  const {
    schema,
    setSchema,
    setSchemaImportLabel,
  } = useGraphStore()
  const [inputName, setInputName] = useState('')
  const [inputText, setInputText] = useState('')
  const [parsers, setParsers] = useState<ParserSpec[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [warnings, setWarnings] = useState<string[]>([])

  const [inputCollapsed, setInputCollapsed] = usePersistedBoolean(LS_KEYS.parserInputCollapsed, true, [LS_LEGACY_KEYS.parserInputCollapsed])
  const [parsersCollapsed, setParsersCollapsed] = usePersistedBoolean(LS_KEYS.parserParsersCollapsed, true, [LS_LEGACY_KEYS.parserParsersCollapsed])

  const [attemptedAutoDetect, setAttemptedAutoDetect] = useState(false)

  useEffect(() => {
    try {
      const s = useParserUIState.getState()
      if (s.inputName || s.inputText) {
        setInputName(s.inputName)
        setInputText(s.inputText)
      }
      if (s.selectedId) setSelectedId(s.selectedId)
      if ((s.warnings || []).length > 0) setWarnings(s.warnings)
      if (s.attemptedAutoDetect) setAttemptedAutoDetect(true)
      if (s.selectedId || (s.counts && (s.counts.n > 0 || s.counts.e > 0))) {
        setParsersCollapsed(false)
      }
    } catch {
      void 0
    }
  }, [setParsersCollapsed])

  useEffect(() => {
    builtInParsers.forEach(p => registerParser(p))
    setParsers(listParsers())
  }, [])

  useEffect(() => {
    const saved = readCustomParsers()
    saved.forEach(cfg => {
      const spec = toParserSpec(cfg)
      if (spec) registerParser(spec)
    })
    setParsers(listParsers())
  }, [])

  useEffect(() => {
    if (!inputText) return
    const bm = bestMatch({ name: inputName, text: inputText })
    if (bm) setSelectedId(bm.id)
  }, [inputName, inputText])

  const selectedSpec = useMemo(() => {
    return parsers.find(p => p.id === selectedId) || null
  }, [parsers, selectedId])

  const persistWorkflowPresetCatalog = useCallback(() => {
    const storage = getLocalStorage()
    writeWorkflowPresetCatalogToStorage(storage, WORKFLOW_PRESETS)
  }, [])

  const persistWorkflowPresetLastApplied = useCallback((entry: WorkflowPresetStorageLastApplied) => {
    const storage = getLocalStorage()
    writeWorkflowPresetLastAppliedToStorage(storage, entry)
  }, [])

  useEffect(() => {
    persistWorkflowPresetCatalog()
  }, [persistWorkflowPresetCatalog])

  const onApplyWorkflowPreset = useCallback(
    (presetId: string) => {
      const preset = WORKFLOW_PRESETS.find(p => String(p.id) === String(presetId))
      if (!preset) return
      try {
        const ui = useParserUIState.getState()
        ui.setSelectedId(preset.parserId)
        ui.setDataLoadStatus(null, `Preset: ${preset.label}`)
      } catch {
        void 0
      }
      setSelectedId(preset.parserId)
      if (preset.threeOverrides) {
        try {
          const currentSchema =
            (useGraphStore.getState().schema as GraphSchema) || (schema as GraphSchema) || defaultSchema
          const baseThree = currentSchema.three || defaultSchema.three
          const nextSchema: GraphSchema = {
            ...currentSchema,
            three: { ...baseThree, ...preset.threeOverrides },
          }
          setSchema(nextSchema)
        } catch {
          void 0
        }
      }
      persistWorkflowPresetLastApplied({
        id: preset.id,
        label: preset.label,
        parserSpecId: preset.parserId,
        datasetFileName: preset.datasetFileName,
        schemaFileName: preset.schemaFileName,
      })
    },
    [schema, setSchema, persistWorkflowPresetLastApplied],
  )

  const onExportJsonLd = useCallback(() => {
    exportGraphJsonLdFromStore()
  }, [])

  const onExportJson = useCallback(() => {
    exportGraphJsonFromStore()
  }, [])

  const onExportCsvCombined = useCallback(() => {
    exportGraphCsvCombinedFromStore()
  }, [])

  const onExportGraphMl = useCallback(() => {
    exportGraphMlFromStore()
  }, [])

  const onExportCypher = useCallback(() => {
    exportCypherFromStore()
  }, [])

  const onClearDataButton = React.useCallback(() => {
    try {
      useGraphStore.getState().clearGraphData()
    } catch {
      void 0
    }
    try {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(null, '')
      ui.setWarnings([])
      ui.setCounts({ n: 0, e: 0 })
    } catch {
      void 0
    }
  }, [])

  const loadWithStatus = React.useCallback(async (loader: () => Promise<LoaderResult | null>) => {
    const res = await loader()
    setAttemptedAutoDetect(true)
    if (!res) return
    if (res.input) {
      setInputName(res.input.name)
      setInputText(res.input.text)
      try {
        useParserUIState.getState().setLastInput(res.input.name, res.input.text)
      } catch {
        void 0
      }
    }
    if (res.parserId) {
      setSelectedId(res.parserId)
      try {
        const ui = useParserUIState.getState()
        ui.setSelectedId(res.parserId)
        const specText = parserSpecTextFromList(listParsers(), res.parserId)
        const current = ui.scriptText || ''
        if ((!current || !current.trim()) && specText && specText.trim()) {
          ui.setScriptText(specText)
        }
        ui.setPreferredLanguage(res.parserId === 'python' ? 'text' : 'json')
      } catch {
        void 0
      }
    }
    if (res.warnings && res.warnings.length > 0) {
      setWarnings(res.warnings)
      try {
        useParserUIState.getState().setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(res.warnings[0]))
      } catch {
        void 0
      }
      try {
        useParserUIState.getState().setWarnings(res.warnings)
      } catch {
        void 0
      }
    } else {
      setWarnings([])
      try {
        useParserUIState.getState().setDataLoadStatus(true, res.input?.name || UI_COPY.parserDataLoadSuccess)
      } catch {
        void 0
      }
      try {
        useParserUIState.getState().setWarnings([])
      } catch {
        void 0
      }
    }
    if (res.counts) {
      try {
        useParserUIState.getState().setCounts(res.counts)
      } catch {
        void 0
      }
    }
    setParsersCollapsed(false)
    if (!res.parserId) {
      try {
        useParserUIState
          .getState()
          .setScriptText('{\n  "node": { "props": { "map": { "id": "$.id" } } }\n}')
      } catch {
        void 0
      }
    }
    openBottomPanel('data')
  }, [setParsersCollapsed])

  const onLoadFileWithStatus = React.useCallback(async () => {
    await loadWithStatus(loadGraphDataViaParser)
  }, [loadWithStatus])

  const onLoadUrlWithStatus = React.useCallback(async () => {
    await loadWithStatus(loadGraphDataFromUrlViaParser)
  }, [loadWithStatus])

  const onLoadBackendWithStatus = React.useCallback(async () => {
    await loadWithStatus(loadGraphDataFromBackendViaParser)
  }, [loadWithStatus])

  const onApplyWorkflowPresetWithLoad = useCallback(
    (presetId: string) => {
      const run = async () => {
        const pipeline = getWorkflowPresetPipeline(presetId as WorkflowPresetId)
        if (!pipeline) return

        onApplyWorkflowPreset(presetId)

        const schemaText = await loadExampleSchemaTextInBrowser(String(pipeline.schemaPath))
        if (!schemaText) {
          try {
            useParserUIState.getState().setDataLoadStatus(false, UI_COPY.parserPresetSchemaNotFoundStatus(String(pipeline.schemaPath)))
          } catch {
            void 0
          }
          return
        }

        try {
          const parsed = JSON.parse(schemaText) as unknown
          const validated = validateSchema(parsed as Partial<GraphSchema>)
          setSchema(validated)
          setSchemaImportLabel(String(pipeline.schemaPath))
        } catch {
          try {
            useParserUIState.getState().setDataLoadStatus(false, UI_COPY.parserPresetSchemaInvalidStatus(String(pipeline.schemaPath)))
          } catch {
            void 0
          }
          return
        }

        const datasetText = await loadExampleDatasetTextInBrowser(String(pipeline.datasetPath))
        if (!datasetText) {
          try {
            useParserUIState.getState().setDataLoadStatus(false, UI_COPY.parserPresetDatasetNotFoundStatus(String(pipeline.datasetPath)))
          } catch {
            void 0
          }
          return
        }

        const name = fileNameFromRepoPath(String(pipeline.datasetPath))
        await loadWithStatus(() => loadGraphDataFromTextViaParser(name, datasetText))
      }

      void run()
    },
    [loadWithStatus, onApplyWorkflowPreset, setSchema, setSchemaImportLabel],
  )

  const onValidateGraph = React.useCallback(() => {
    try {
      const store = useGraphStore.getState()
      const currentData = store.graphData
      const currentSchema = store.schema as GraphSchema
      if (!currentData) {
        useParserUIState.getState().setDataLoadStatus(false, UI_COPY.parserValidateNoDataStatus)
        return
      }
      const result = validateGraphDataWithSchema(currentData, currentSchema)
      const hasErrors = result.errors.length > 0
      const msg = hasErrors
        ? UI_COPY.parserValidateStructureCompletedWithErrorsStatus
        : UI_COPY.parserValidateStructureCompletedStatus
      useParserUIState.getState().setDataLoadStatus(!hasErrors, msg)
      try {
        store.setGraphValidationResult(hasErrors ? 'invalid' : 'valid', Date.now())
      } catch {
        void 0
      }
    } catch {
      void 0
    }
    openBottomPanel('nodes')
  }, [])

  const parserSelectionProps = useMemo(
    () => ({
      parsersCollapsed,
      onParsersCollapsedChange: setParsersCollapsed,
      detection: {
        hasSelectedSpec: !!selectedSpec,
        attemptedAutoDetect,
        inputText,
        warnings,
      },
    }),
    [parsersCollapsed, setParsersCollapsed, selectedSpec, attemptedAutoDetect, inputText, warnings],
  )

  const parserDataProps = useMemo(
    () => ({
      inputCollapsed,
      onInputCollapsedChange: setInputCollapsed,
      onLoadFileWithStatus,
      onLoadUrlWithStatus,
      onLoadBackendWithStatus,
      onClearDataButton,
      onExportJsonLd,
      onExportJson,
      onExportCsvCombined,
      onExportGraphMl,
      onExportCypher,
      presets: [],
      onApplyPreset: () => void 0,
      onValidateGraph,
    }),
    [
      inputCollapsed,
      setInputCollapsed,
      onLoadFileWithStatus,
      onLoadUrlWithStatus,
      onLoadBackendWithStatus,
      onClearDataButton,
      onExportJsonLd,
      onExportJson,
      onExportCsvCombined,
      onExportGraphMl,
      onExportCypher,
      onValidateGraph,
    ],
  )

  const applyExampleById = useCallback(
    (exampleId: ExampleId) => {
      const example = EXAMPLES_BY_ID[exampleId]
      if (!example) return
      const preset = WORKFLOW_PRESETS.find(p => String(p.datasetFileName) === String(example.datasetPath))
      if (!preset) return
      onApplyWorkflowPresetWithLoad(String(preset.id))
    },
    [onApplyWorkflowPresetWithLoad],
  )

  return {
    parserSelectionProps,
    parserDataProps,
    applyExampleById,
  }
}
