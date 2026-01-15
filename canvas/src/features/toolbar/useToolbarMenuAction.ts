import { useCallback, useMemo, type RefObject } from 'react'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { useParserUIState } from '@/features/parsers/uiState'
import {
  loadGraphDataViaParser,
  type LoaderResult,
} from '@/features/parsers/loader'
import type { ToolMenuAction, ToolMenuArea, ToolMenuPayload } from '@/features/toolbar/toolMenu'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { downloadBlob } from '@/lib/graph/save'
import MarkdownIt from 'markdown-it'
import { performMarkdownImport } from './markdownImportAction'
import { performHtmlImport } from './htmlImportAction'
import { performPdfImport } from './pdfImportAction'
import { performJsonImport, performCsvImport } from './jsonImportAction'
import { promptForUrl } from './ingestUtils'

export function useToolbarMenuAction(args: {
  closeToolMenu: () => void
  openWorkflowTab: () => void
  onOpenMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'settings') => void
  orchestratorImportInputRef: RefObject<HTMLInputElement | null>
  setIsMarkdownImportMenuOpen: (open: boolean) => void
  setIsHtmlImportMenuOpen: (open: boolean) => void
  setIsPdfImportMenuOpen: (open: boolean) => void
  setIsSchemaExportMenuOpen: (open: boolean) => void
  exportGraphJsonLd: () => void
  exportGraphJson: () => void
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
  const {
    closeToolMenu,
    exportGraphJsonLd,
    exportGraphJson,
    importSchemaJsonOrJsonLd,
    importGraphFieldSettingsJsonLd,
    importSettingsJsonLd,
    importHistoryJsonLd,
  } = args
  const markdownToHtml = useMemo(() => {
    return new MarkdownIt({
      html: true,
      linkify: false,
      typographer: false,
      breaks: false,
    })
  }, [])
  return useCallback(
    (area: ToolMenuArea, action: ToolMenuAction, payload?: ToolMenuPayload) => {
      closeToolMenu()
      const applyLoaderResultToUi = (res: LoaderResult) => {
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
      }
      const clearLoaderStatusIfNoInput = () => {
        try {
          const ui = useParserUIState.getState()
          ui.setDataLoadStatus(null, '')
        } catch {
          void 0
        }
      }
      const setLoaderFailedStatus = () => {
        try {
          const ui = useParserUIState.getState()
          ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
        } catch {
          void 0
        }
      }
      const exportMarkdownDocument = () => {
        try {
          const state = useGraphStore.getState()
          const name = state.markdownDocumentName
          const text = state.markdownDocumentText
          const content = typeof text === 'string' ? text : ''
          if (!content.trim()) {
            return
          }
          const rawName = typeof name === 'string' && name.trim() ? name.trim() : 'document.md'
          const base =
            rawName.replace(/\.(pdf|html|htm|jsonld|json|yaml|yml|md|markdown)$/i, '') || 'document'
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
      }

      const exportHtmlDocument = () => {
        try {
          const state = useGraphStore.getState()
          const name = state.markdownDocumentName
          const text = state.markdownDocumentText
          const markdown = typeof text === 'string' ? text : ''
          if (!markdown.trim()) return
          const rawName = typeof name === 'string' && name.trim() ? name.trim() : 'document.md'
          const base =
            rawName.replace(/\.(pdf|html|htm|jsonld|json|yaml|yml|md|markdown)$/i, '') || 'document'
          const filename = rawName.toLowerCase().endsWith('.html') || rawName.toLowerCase().endsWith('.htm')
            ? rawName
            : `${base}.html`
          const htmlBody = markdownToHtml.render(markdown)
          const style = `
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
            h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 2rem; margin-bottom: 1rem; }
            h1 { border-bottom: 1px solid #eaeaea; padding-bottom: 0.5rem; }
            pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
            code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 0.9em; background: rgba(175, 184, 193, 0.2); padding: 0.2em 0.4em; border-radius: 4px; }
            pre code { background: transparent; padding: 0; }
            blockquote { border-left: 4px solid #dfe2e5; padding-left: 1rem; color: #6a737d; margin: 1rem 0; }
            table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
            th, td { border: 1px solid #dfe2e5; padding: 0.6rem 1rem; }
            th { background: #f6f8fa; font-weight: 600; }
            img { max-width: 100%; height: auto; }
            a { color: #0969da; text-decoration: none; }
            a:hover { text-decoration: underline; }
          `
          const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${base}</title><style>${style}</style></head><body>${htmlBody}</body></html>`
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
          downloadBlob(blob, filename)
        } catch {
          void 0
        }
      }

      const exportPdfDocument = () => {
        try {
          if (typeof window === 'undefined') return
          const state = useGraphStore.getState()
          const name = state.markdownDocumentName
          const text = state.markdownDocumentText
          const markdown = typeof text === 'string' ? text : ''
          if (!markdown.trim()) return
          const rawName = typeof name === 'string' && name.trim() ? name.trim() : 'document.md'
          const base =
            rawName.replace(/\.(pdf|html|htm|jsonld|json|yaml|yml|md|markdown)$/i, '') || 'document'
          const htmlBody = markdownToHtml.render(markdown)
          const style = `
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
            h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 2rem; margin-bottom: 1rem; }
            h1 { border-bottom: 1px solid #eaeaea; padding-bottom: 0.5rem; }
            pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
            code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 0.9em; background: rgba(175, 184, 193, 0.2); padding: 0.2em 0.4em; border-radius: 4px; }
            pre code { background: transparent; padding: 0; }
            blockquote { border-left: 4px solid #dfe2e5; padding-left: 1rem; color: #6a737d; margin: 1rem 0; }
            table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
            th, td { border: 1px solid #dfe2e5; padding: 0.6rem 1rem; }
            th { background: #f6f8fa; font-weight: 600; }
            img { max-width: 100%; height: auto; }
            a { color: #0969da; text-decoration: none; }
            a:hover { text-decoration: underline; }
            @media print {
              body { max-width: none; padding: 0; }
              pre { white-space: pre-wrap; }
            }
          `
          const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${base}</title><style>${style}</style></head><body>${htmlBody}</body></html>`
          const w = window.open('', '_blank', 'noopener,noreferrer')
          if (!w) return
          w.document.open()
          w.document.write(html)
          w.document.close()
          w.focus()
          setTimeout(() => {
            try {
              w.print()
            } catch {
              void 0
            }
          }, 500)
        } catch {
          void 0
        }
      }

      if (area === 'sourceFiles') {
        const format = typeof payload?.format === 'string' ? payload.format : ''
        if (action === 'import') {
          if (format === 'markdown') {
            void (async () => {
              try {
                const providedUrl = typeof payload?.url === 'string' ? payload.url.trim() : ''
                if (providedUrl) {
                  await performMarkdownImport('url', providedUrl)
                  return
                }
                const rawUrl = promptForUrl(UI_COPY.markdownImportUrlPrompt)
                if (rawUrl) {
                  await performMarkdownImport('url', rawUrl)
                } else {
                  await performMarkdownImport('local')
                }
              } catch {
                void 0
              }
            })()
            return
          }
          if (format === 'html') {
            void (async () => {
              try {
                const rawUrl = promptForUrl(UI_COPY.htmlImportUrlPrompt)
                if (rawUrl) {
                  await performHtmlImport('url', rawUrl)
                } else {
                  await performHtmlImport('local')
                }
              } catch {
                void 0
              }
            })()
            return
          }
          if (format === 'pdf') {
            void (async () => {
              try {
                const rawUrl = promptForUrl(UI_COPY.pdfImportUrlPrompt)
                if (rawUrl) {
                  await performPdfImport('url', rawUrl)
                } else {
                  await performPdfImport('local')
                }
              } catch {
                void 0
              }
            })()
            return
          }
          if (format === 'jsonld' || format === 'json') {
            void (async () => {
              try {
                const rawUrl = promptForUrl(UI_COPY.jsonImportUrlPrompt)
                if (rawUrl) {
                  await performJsonImport('url', format, rawUrl)
                } else {
                  await performJsonImport('local', format)
                }
              } catch {
                setLoaderFailedStatus()
              }
            })()
            return
          }
          if (format === 'csv') {
            void (async () => {
              try {
                await performCsvImport()
              } catch {
                setLoaderFailedStatus()
              }
            })()
            return
          }
          return
        }
        if (action === 'importLocal') {
          if (format === 'markdown') {
            void performMarkdownImport('local')
            return
          }
          if (format === 'html') {
            void performHtmlImport('local')
            return
          }
          if (format === 'pdf') {
            void performPdfImport('local')
            return
          }
          if (format === 'jsonld' || format === 'json') {
            void performJsonImport('local', format)
            return
          }
          if (format === 'csv') {
            void performCsvImport()
            return
          }
          return
        }
        if (action === 'importUrl') {
          const url = typeof payload?.url === 'string' ? payload.url.trim() : ''
          if (!url) return
          if (format === 'markdown') {
            void performMarkdownImport('url', url)
            return
          }
          if (format === 'html') {
            void performHtmlImport('url', url)
            return
          }
          if (format === 'pdf') {
            void performPdfImport('url', url)
            return
          }
          if (format === 'jsonld' || format === 'json') {
            void performJsonImport('url', format, url)
            return
          }
          return
        }
        if (action === 'export') {
          if (format === 'markdown') {
            exportMarkdownDocument()
            return
          }
          if (format === 'html') {
            exportHtmlDocument()
            return
          }
          if (format === 'pdf') {
            exportPdfDocument()
            return
          }
          if (format === 'jsonld') {
            try {
              exportGraphJsonLd()
            } catch {
              void 0
            }
            return
          }
          if (format === 'json') {
            try {
              exportGraphJson()
            } catch {
              void 0
            }
            return
          }
          return
        }
      }
      if (area === 'schemaConfig') {
        if (action === 'import') {
          try {
            importSchemaJsonOrJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'graphFields') {
        if (action === 'import') {
          try {
            importGraphFieldSettingsJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'settings') {
        if (action === 'import') {
          try {
            importSettingsJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'history') {
        if (action === 'import') {
          try {
            importHistoryJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
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
                clearLoaderStatusIfNoInput()
                return
              }
              applyLoaderResultToUi(res)
            } catch {
              setLoaderFailedStatus()
            }
          })()
          return
        }
      }
    },
    [
      closeToolMenu,
      exportGraphJsonLd,
      exportGraphJson,
      importSchemaJsonOrJsonLd,
      importGraphFieldSettingsJsonLd,
      importSettingsJsonLd,
      importHistoryJsonLd,
      markdownToHtml,
    ]
  )
}
