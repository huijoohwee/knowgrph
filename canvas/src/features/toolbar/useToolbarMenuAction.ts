import { useCallback, type RefObject } from 'react'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { useParserUIState } from '@/features/parsers/uiState'
import { importParser, resetParserUiState } from '@/features/parsers/uiUtils'
import { loadGraphDataViaParser, loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildGraphRagWorkflowJsonLdDocument } from '@/features/panels/utils/workflowJsonLd'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { UI_COPY } from '@/lib/config'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { downloadBlob } from '@/lib/graph/save'
import { coerceHttpUrl, fetchRemoteMarkdownText, isMarkdownUrlPath } from './markdownImport'

export function useToolbarMenuAction({
  closeToolMenu,
  openWorkflowTab,
  onOpenMainPanel,
  orchestratorImportInputRef,
  setIsMarkdownImportMenuOpen,
  exportGraphFieldSettingsJsonLd,
  exportGraphRagWorkflowJsonLd,
  exportHistoryJsonLd,
  exportSettingsJsonLd,
  importGraphFieldSettingsJsonLd,
  importGraphRagWorkflowJsonLd,
  importHistoryJsonLd,
  importSchemaJsonOrJsonLd,
  importSettingsJsonLd,
}: {
  closeToolMenu: () => void
  openWorkflowTab: () => void
  onOpenMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'settings') => void
  orchestratorImportInputRef: RefObject<HTMLInputElement | null>
  setIsMarkdownImportMenuOpen: (open: boolean) => void
  exportGraphFieldSettingsJsonLd: () => void
  exportGraphRagWorkflowJsonLd: () => void
  exportHistoryJsonLd: () => void
  exportSettingsJsonLd: () => void
  importGraphFieldSettingsJsonLd: () => void
  importGraphRagWorkflowJsonLd: () => void
  importHistoryJsonLd: () => void
  importSchemaJsonOrJsonLd: () => void
  importSettingsJsonLd: () => void
}) {
  return useCallback(
    (area: ToolMenuArea, action: ToolMenuAction, payload?: { url?: string }) => {
      closeToolMenu()
      if (area === 'curator') {
        if (action === 'new') {
          try {
            useGraphStore.getState().clearGraphData()
          } catch {
            void 0
          }
          openBottomPanel('curation')
          return
        }
        if (action === 'clear') {
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
          return
        }
        if (action === 'import') {
          void (async () => {
            try {
              const res = await loadGraphDataViaParser()
              if (!res) {
                try {
                  const ui = useParserUIState.getState()
                  ui.setDataLoadStatus(null, '')
                } catch {
                  void 0
                }
                return
              }
              try {
                const ui = useParserUIState.getState()
                if (res.input) {
                  ui.setLastInput(res.input.name, res.input.text)
                }
                if (res.warnings && res.warnings.length > 0) {
                  ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(res.warnings[0] || ''))
                  ui.setWarnings(res.warnings)
                } else {
                  ui.setDataLoadStatus(true, res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess)
                  ui.setWarnings([])
                }
                if (res.counts) {
                  ui.setCounts(res.counts)
                }
              } catch {
                void 0
              }
            } catch {
              try {
                const ui = useParserUIState.getState()
                ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
              } catch {
                void 0
              }
            }
            openBottomPanel('data')
          })()
          return
        }
        if (action === 'export') {
          openWorkflowTab()
          return
        }
        openBottomPanel('curation')
        return
      }
      if (area === 'parser') {
        if (action === 'new' || action === 'clear') {
          resetParserUiState()
          openBottomPanel('parser')
          return
        }
        if (action === 'import') {
          void importParser().then(() => {
            openBottomPanel('parser')
          })
          return
        }
        openBottomPanel('parser')
        return
      }
      if (area === 'markdown') {
        if (action === 'import' || action === 'importLocal' || action === 'importUrl') {
          void (async () => {
            try {
              setIsMarkdownImportMenuOpen(false)
              const picked = await (async (): Promise<{ name: string; text: string; displayName?: string } | null> => {
                if (action === 'importUrl') {
                  const rawUrl = (() => {
                    const v = typeof payload?.url === 'string' ? payload.url.trim() : ''
                    if (v) return v
                    return typeof window !== 'undefined'
                      ? String(window.prompt(UI_COPY.markdownImportUrlPrompt, '') || '').trim()
                      : ''
                  })()
                  if (!rawUrl) return null
                  return fetchRemoteMarkdownText(rawUrl)
                }
                if (action === 'importLocal') {
                  return pickTextFileWithExtensions(['.md', '.markdown'])
                }
                const rawUrl =
                  typeof window !== 'undefined'
                    ? String(window.prompt(UI_COPY.markdownImportUrlPrompt, '') || '').trim()
                    : ''
                return rawUrl
                  ? fetchRemoteMarkdownText(rawUrl)
                  : pickTextFileWithExtensions(['.md', '.markdown'])
              })()
              if (!picked) return

              const res = await loadGraphDataFromTextViaParser(picked.name, picked.text)
              if (!res) {
                try {
                  const ui = useParserUIState.getState()
                  ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
                } catch {
                  void 0
                }
                return
              }
              try {
                const ui = useParserUIState.getState()
                if (res.input) {
                  ui.setLastInput(res.input.name, res.input.text)
                }
                if (res.warnings && res.warnings.length > 0) {
                  ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(res.warnings[0] || ''))
                  ui.setWarnings(res.warnings)
                } else {
                  ui.setDataLoadStatus(true, res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess)
                  ui.setWarnings([])
                }
                if (res.counts) {
                  ui.setCounts(res.counts)
                }
              } catch {
                void 0
              }
              try {
                const state = useGraphStore.getState()
                if (res.input && res.input.text.trim()) {
                  const documentName =
                    typeof picked.displayName === 'string' && picked.displayName.trim()
                      ? picked.displayName.trim()
                      : res.input.name || null
                  state.setMarkdownDocument(documentName, res.input.text)
                  const sourceUrl = (() => {
                    const url = coerceHttpUrl(res.input?.name || '')
                    return url && isMarkdownUrlPath(url) ? url : null
                  })()
                  state.setMarkdownDocumentSourceUrl(sourceUrl)
                } else {
                  state.setMarkdownDocument(null, null)
                  state.setMarkdownDocumentSourceUrl(null)
                }
                state.setBottomPanelCurationView('markdown')
              } catch {
                void 0
              }
              openBottomPanel('curation')
            } catch {
              try {
                const ui = useParserUIState.getState()
                ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
              } catch {
                void 0
              }
            }
          })()
          return
        }
        if (action === 'export') {
          try {
            const state = useGraphStore.getState()
            const name = state.markdownDocumentName
            const text = state.markdownDocumentText
            const content = typeof text === 'string' ? text : ''
            if (!content.trim()) {
              return
            }
            const rawName = typeof name === 'string' && name.trim() ? name.trim() : 'document.md'
            const base = rawName.replace(/\.(jsonld|json|yaml|yml)$/i, '') || 'document'
            const filename =
              rawName.toLowerCase().endsWith('.md') || rawName.toLowerCase().endsWith('.markdown')
                ? rawName
                : `${base}.md`
            const blob = new Blob([content], {
              type: 'text/markdown;charset=utf-8',
            })
            downloadBlob(blob, filename)
          } catch {
            void 0
          }
          try {
            const state = useGraphStore.getState()
            state.setBottomPanelCurationView('markdown')
          } catch {
            void 0
          }
          openBottomPanel('curation')
          return
        }
        try {
          const state = useGraphStore.getState()
          state.setBottomPanelCurationView('markdown')
        } catch {
          void 0
        }
        openBottomPanel('curation')
        return
      }
      if (area === 'schemaConfig') {
        if (action === 'import') {
          try {
            importSchemaJsonOrJsonLd()
          } catch {
            void 0
          }
          openBottomPanel('schema')
          return
        }
        if (action === 'export') {
          openBottomPanel('schema')
          return
        }
        openBottomPanel('schema')
        return
      }
      if (area === 'graphFields') {
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'graphFields' } }))
          }
        } catch {
          void 0
        }
        if (action === 'export') {
          try {
            exportGraphFieldSettingsJsonLd()
          } catch {
            void 0
          }
          openWorkflowTab()
          return
        }
        if (action === 'import') {
          try {
            importGraphFieldSettingsJsonLd()
          } catch {
            void 0
          }
          return
        }
        return
      }
      if (area === 'orchestrator') {
        if (action === 'new') {
          try {
            const state = useGraphStore.getState()
            const doc = buildGraphRagWorkflowJsonLdDocument(state.graphId)
            const text = JSON.stringify(doc, null, 2)
            state.setGraphRagWorkflowJsonText(text)
          } catch {
            try {
              useGraphStore.getState().setGraphRagWorkflowJsonText(null)
            } catch {
              void 0
            }
          }
          openBottomPanel('orchestrator')
          return
        }
        if (action === 'clear') {
          try {
            useGraphStore.getState().setGraphRagWorkflowJsonText(null)
          } catch {
            void 0
          }
          openBottomPanel('orchestrator')
          return
        }
        if (action === 'import') {
          if (orchestratorImportInputRef.current) {
            try {
              orchestratorImportInputRef.current.click()
            } catch {
              void 0
            }
          } else {
            openBottomPanel('orchestrator')
          }
          return
        }
        if (action === 'export') {
          try {
            exportGraphRagWorkflowJsonLd()
          } catch {
            void 0
          }
          openWorkflowTab()
          return
        }
        openBottomPanel('orchestrator')
        return
      }
      if (area === 'render') {
        if (action === 'import') {
          try {
            importGraphRagWorkflowJsonLd()
          } catch {
            void 0
          }
          openWorkflowTab()
          return
        }
        if (action === 'export') {
          openWorkflowTab()
          return
        }
        openBottomPanel('render')
        return
      }
      if (area === 'settings') {
        if (action === 'import') {
          try {
            importSettingsJsonLd()
          } catch {
            void 0
          }
          onOpenMainPanel('settings')
          return
        }
        if (action === 'export') {
          try {
            exportSettingsJsonLd()
          } catch {
            void 0
          }
          openWorkflowTab()
          return
        }
        onOpenMainPanel('settings')
        return
      }
      if (area === 'history') {
        if (action === 'import') {
          try {
            importHistoryJsonLd()
          } catch {
            void 0
          }
          openBottomPanel('history')
          return
        }
        if (action === 'export') {
          try {
            exportHistoryJsonLd()
          } catch {
            void 0
          }
          openWorkflowTab()
          return
        }
        openBottomPanel('history')
        return
      }
    },
    [
      closeToolMenu,
      exportGraphFieldSettingsJsonLd,
      exportGraphRagWorkflowJsonLd,
      exportHistoryJsonLd,
      exportSettingsJsonLd,
      importGraphFieldSettingsJsonLd,
      importGraphRagWorkflowJsonLd,
      importHistoryJsonLd,
      importSchemaJsonOrJsonLd,
      importSettingsJsonLd,
      onOpenMainPanel,
      openWorkflowTab,
      orchestratorImportInputRef,
      setIsMarkdownImportMenuOpen,
    ],
  )
}
