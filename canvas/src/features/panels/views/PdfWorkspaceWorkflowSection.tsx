import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, RefreshCcw, Upload } from 'lucide-react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { PdfConversionMode, PdfWorkspaceDocumentMeta } from '@/lib/pdf/pdfWorkspaceAnchors'
import { importPdfToWorkspace, listPdfWorkspaceDocs } from '@/lib/pdf/pdfWorkspaceClient'
import { readPdfWorkspaceOutputDirRel, writePdfWorkspaceOutputDirRel } from '@/lib/pdf/pdfWorkspacePreferences'

type ViewKey = 'workspace' | 'import'

function normalizeMode(raw: string): PdfConversionMode {
  if (raw === 'image-heavy') return 'image-heavy'
  if (raw === 'scan-ocr') return 'scan-ocr'
  return 'text-only'
}

export default function PdfWorkspaceWorkflowSection() {
  const navigate = useNavigate()
  const conversionMode = useGraphStore(s => s.pdfImportConversionMode)
  const setConversionMode = useGraphStore(s => s.setPdfImportConversionMode)

  const [view, setView] = React.useState<ViewKey>('workspace')
  const [outputDirRel, setOutputDirRel] = React.useState(() => readPdfWorkspaceOutputDirRel())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [docs, setDocs] = React.useState<PdfWorkspaceDocumentMeta[]>([])
  const [file, setFile] = React.useState<File | null>(null)
  const [lastDocId, setLastDocId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const normalized = writePdfWorkspaceOutputDirRel(outputDirRel)
    if (normalized !== outputDirRel) setOutputDirRel(normalized)
  }, [outputDirRel])

  const loadDocs = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await listPdfWorkspaceDocs({ outputDirRel })
      if (res.ok !== true) {
        setError(res.error)
        setDocs([])
        return
      }
      setDocs(Array.isArray(res.index.docs) ? res.index.docs : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
      setDocs([])
    } finally {
      setBusy(false)
    }
  }, [outputDirRel])

  React.useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  const onImport = React.useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await importPdfToWorkspace({
        file,
        conversionMode: normalizeMode(conversionMode),
        outputDirRel,
      })
      if (res.ok !== true) {
        setError(res.error)
        return
      }
      setLastDocId(res.docId)
      setNotice(`Wrote ${res.artifacts.mdRelPath}`)
      setFile(null)
      await loadDocs()
      setView('workspace')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }, [conversionMode, file, loadDocs, outputDirRel])

  return (
    <CollapsibleSection
      title={(
        <span className="inline-flex items-center gap-2">
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>PDF → Markdown (Local Workspace)</span>
        </span>
      )}
      defaultCollapsed={true}
      toolbarAligned
      actions={(
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg} hover:opacity-90 text-[11px]`}
          onClick={() => void loadDocs()}
          disabled={busy}
          aria-label="Refresh PDF workspace"
        >
          <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Refresh
        </button>
      )}
    >
      <section aria-label="PDF workspace settings" className="space-y-2">
        <form
          aria-label="PDF workspace output directory"
          className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-2`}
          onSubmit={e => e.preventDefault()}
        >
          <label className={`block text-[11px] font-semibold ${UI_THEME_TOKENS.text.secondary}`} htmlFor="kgPdfWorkspaceOutputDir">
            Output directory (repo-relative)
          </label>
          <input
            id="kgPdfWorkspaceOutputDir"
            className={`mt-1 w-full rounded border px-2 py-1 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}
            value={outputDirRel}
            onChange={e => setOutputDirRel(e.target.value)}
            inputMode="text"
            spellCheck={false}
            aria-label="PDF workspace output directory"
          />
          <output className={`mt-1 block text-[11px] ${UI_THEME_TOKENS.text.tertiary}`} aria-label="Workspace constraint">
            Must stay under <code>.knowgrph-workspace/</code>
          </output>
        </form>

        <nav aria-label="PDF workflow mode" className="flex items-center gap-2">
          <button
            type="button"
            className={`px-2 py-1 rounded border text-[11px] ${UI_THEME_TOKENS.input.border} ${view === 'workspace' ? UI_THEME_TOKENS.panel.bg : ''}`}
            onClick={() => setView('workspace')}
            aria-current={view === 'workspace' ? 'page' : undefined}
          >
            Workspace
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded border text-[11px] ${UI_THEME_TOKENS.input.border} ${view === 'import' ? UI_THEME_TOKENS.panel.bg : ''}`}
            onClick={() => setView('import')}
            aria-current={view === 'import' ? 'page' : undefined}
          >
            Import
          </button>
          {lastDocId && (
            <button
              type="button"
              className={`ml-auto px-2 py-1 rounded border text-[11px] ${UI_THEME_TOKENS.input.border} hover:opacity-90`}
              onClick={() => {
                navigate(`/doc/${encodeURIComponent(lastDocId)}?mode=${encodeURIComponent(normalizeMode(conversionMode))}&outputDirRel=${encodeURIComponent(outputDirRel)}`)
              }}
            >
              Open last
            </button>
          )}
        </nav>

        {notice && (
          <output className={`block text-[11px] ${UI_THEME_TOKENS.text.tertiary}`} aria-label="PDF notice">
            {notice}
          </output>
        )}
        {error && (
          <output className="block text-xs text-red-400" aria-label="PDF error">
            {error}
          </output>
        )}

        {view === 'import' ? (
          <section aria-label="Import PDF" className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-2 space-y-2`}>
            <form
              aria-label="PDF import form"
              className="space-y-2"
              onSubmit={e => {
                e.preventDefault()
                void onImport()
              }}
            >
              <label className={`block text-[11px] font-semibold ${UI_THEME_TOKENS.text.secondary}`} htmlFor="kgPdfFile">
                PDF file
              </label>
              <input
                id="kgPdfFile"
                type="file"
                accept="application/pdf,.pdf"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-xs"
              />

              <label className={`block text-[11px] font-semibold ${UI_THEME_TOKENS.text.secondary}`} htmlFor="kgPdfMode">
                Conversion mode
              </label>
              <select
                id="kgPdfMode"
                className={`w-full text-xs px-2 py-1 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}
                value={normalizeMode(conversionMode)}
                onChange={e => setConversionMode(normalizeMode(e.target.value))}
              >
                <option value="text-only">Text-only (default)</option>
                <option value="image-heavy">Image-heavy</option>
                <option value="scan-ocr">Scan / OCR</option>
              </select>

              <button
                type="submit"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border ${UI_THEME_TOKENS.input.border} hover:opacity-90 text-xs`}
                disabled={busy || !file}
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Convert
              </button>
            </form>
          </section>
        ) : (
          <section aria-label="Workspace documents" className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}>
            <table className="w-full text-xs" aria-label="Imported documents">
              <thead className={`border-b ${UI_THEME_TOKENS.panel.border}`}>
                <tr>
                  <th scope="col" className={`text-left px-2 py-2 ${UI_THEME_TOKENS.text.secondary}`}>Name</th>
                  <th scope="col" className={`text-left px-2 py-2 ${UI_THEME_TOKENS.text.secondary}`}>Updated</th>
                  <th scope="col" className={`text-left px-2 py-2 ${UI_THEME_TOKENS.text.secondary}`}>Mode</th>
                  <th scope="col" className={`text-right px-2 py-2 ${UI_THEME_TOKENS.text.secondary}`}>Open</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-2 py-3 ${UI_THEME_TOKENS.text.tertiary}`}>
                      No imported PDFs yet.
                    </td>
                  </tr>
                ) : (
                  docs.map(d => (
                    <tr key={d.docId} className={`border-t ${UI_THEME_TOKENS.panel.border}`}>
                      <td className="px-2 py-2">
                        <span className="truncate inline-block max-w-[18rem]" title={d.title}>
                          {d.title}
                        </span>
                      </td>
                      <td className={`px-2 py-2 ${UI_THEME_TOKENS.text.tertiary}`}>
                        {new Date(d.updatedAtMs).toLocaleString()}
                      </td>
                      <td className={`px-2 py-2 ${UI_THEME_TOKENS.text.tertiary}`}>{d.lastMode}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          className={`inline-flex items-center px-2 py-1 rounded border ${UI_THEME_TOKENS.input.border} hover:opacity-90`}
                          onClick={() => {
                            navigate(`/doc/${encodeURIComponent(d.docId)}?mode=${encodeURIComponent(d.lastMode)}&outputDirRel=${encodeURIComponent(outputDirRel)}`)
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </CollapsibleSection>
  )
}
