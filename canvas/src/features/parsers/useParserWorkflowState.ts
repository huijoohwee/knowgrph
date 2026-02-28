import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { listParsers, registerParser, bestMatch, readCustomParsers } from '@/features/parsers'
import type { ParserSpec } from '@/features/parsers'
import { toParserSpec } from '@/features/parsers'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { useParserUIState } from '@/features/parsers/uiState'
import { parserSpecTextFromList } from '@/features/parsers/specFormat'
import { ensureBuiltInParsersRegistered } from '@/features/parsers/ensure'
import {
  loadGraphDataViaParser,
  loadGraphDataFromBackendViaParser,
  loadGraphDataFromTextViaParser,
  type LoaderResult,
} from '@/features/parsers/loader'
import { promptForUrl } from '@/features/toolbar/ingestUtils'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'
import { useGraphStore } from '@/hooks/useGraphStore'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { GraphSchema, defaultSchema } from '@/lib/graph/schema'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { validateSchema } from '@/features/schema/validation'
import { EXAMPLES_BY_ID, type ExampleId } from '@/features/parsers/examplesCatalog'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import {
  WORKFLOW_PRESETS,
  type WorkflowPresetId,
  type WorkflowPresetStorageLastApplied,
  getWorkflowPresetPipeline,
  loadExampleDatasetTextInBrowser,
  loadExampleSchemaTextInBrowser,
  fileNameFromRepoPath,
  writeWorkflowPresetCatalogToStorage,
  writeWorkflowPresetLastAppliedToStorage,
} from '@/features/parsers/workflowPresets'
import {
  exportGraphJsonLdFromStore,
  exportGraphJsonFromStore,
  exportGraphCsvCombinedFromStore,
  exportGraphMlFromStore,
  exportCypherFromStore,
  exportGraphMarkdownFromStore,
} from '@/features/parsers/storeExportActions'

const PRESET_ID_BY_EXAMPLE_ID: Record<ExampleId, string> = {
  sampleTop3Portfolio: 'sample-investors-top3-3d',
  genericKgVisualization: 'ai-kg-viz',
  customerVoiceManagement: 'aiCustomerVoiceManagement',
  universalLeanStartup: 'universal-lean-startup-kg',
  investorsJsonLd: 'a0-investors-kg',
  ventureCapitalPortfolio: 'venture-capital-portfolio',
  exampleWorkflow: 'example-workflow',
  multiOntologyWorkflow: 'multi-ontology-kg',
  edaMlpPipeline: 'eda-mlp-pipeline-path',
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

  const [inputCollapsed, setInputCollapsed] = usePersistedBoolean(LS_KEYS.parserInputCollapsed, true)
  const [parsersCollapsed, setParsersCollapsed] = usePersistedBoolean(LS_KEYS.parserParsersCollapsed, true)

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
    ensureBuiltInParsersRegistered()
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

  const onExportMarkdownGraph = useCallback(() => {
    exportGraphMarkdownFromStore()
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
    try {
      useGraphStore.getState().setWorkspaceViewMode('table')
    } catch {
      void 0
    }
  }, [setParsersCollapsed])

  const onLoadFileWithStatus = React.useCallback(async () => {
    await loadWithStatus(loadGraphDataViaParser)
  }, [loadWithStatus])

  const onLoadUrlWithStatus = React.useCallback(async () => {
    const rawUrl = promptForUrl(UI_COPY.jsonImportUrlPrompt)
    if (!rawUrl) return
    const text = await fetchRemoteText(rawUrl)
    if (!text) {
      try {
        useParserUIState.getState().setDataLoadStatus(false, UI_COPY.jsonImportFetchFailedStatus(rawUrl))
      } catch {
        void 0
      }
      return
    }
    const name = (() => {
      try {
        const url = new URL(rawUrl)
        const parts = url.pathname.split('/').filter(Boolean)
        const last = parts[parts.length - 1] || ''
        return last || 'remote.json'
      } catch {
        return 'remote.json'
      }
    })()
    await loadWithStatus(async () => {
      const result = await loadGraphDataFromTextViaParser(name, text)
      try {
        const state = useGraphStore.getState()
        const normalizedText = normalizeMermaidMmdToMarkdown(name, text)
        if (normalizedText.trim()) {
          state.setMarkdownDocument(name, normalizedText)
          state.setMarkdownDocumentSourceUrl(rawUrl)
        }
      } catch {
        void 0
      }
      return result
    })
  }, [loadWithStatus])

  const onLoadBackendWithStatus = React.useCallback(async () => {
    const rawUrl = promptForUrl(UI_COPY.parserBackendUrlPrompt)
    if (!rawUrl) return
    await loadWithStatus(() => loadGraphDataFromBackendViaParser(rawUrl))
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
        await loadWithStatus(async () => {
          const result = await loadGraphDataFromTextViaParser(name, datasetText)
          try {
            const state = useGraphStore.getState()
            const normalizedText = normalizeMermaidMmdToMarkdown(name, datasetText)
            if (normalizedText.trim()) {
              state.setMarkdownDocument(name, normalizedText)
              state.setMarkdownDocumentSourceUrl(null)
            }
          } catch {
            void 0
          }
          return result
        })
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
    try {
      useGraphStore.getState().setWorkspaceViewMode('table')
    } catch {
      void 0
    }
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
      onExportMarkdownGraph,
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
      onExportMarkdownGraph,
      onValidateGraph,
    ],
  )

  const applyExampleById = useCallback(
    (exampleId: ExampleId) => {
      const presetId = PRESET_ID_BY_EXAMPLE_ID[exampleId]
      if (!presetId) return
      if (!EXAMPLES_BY_ID[exampleId]) return
      onApplyWorkflowPresetWithLoad(presetId)
    },
    [onApplyWorkflowPresetWithLoad],
  )

  return {
    parserSelectionProps,
    parserDataProps,
    applyExampleById,
  }
}
