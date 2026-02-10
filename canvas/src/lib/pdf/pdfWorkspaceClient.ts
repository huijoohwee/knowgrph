import { PDF_WORKSPACE_API, PDF_WORKSPACE_DIR_REL_DEFAULT } from './pdfWorkspaceConfig'
import type { PdfConversionMode, PdfWorkspaceIndex, PdfWorkspaceAnchorMap, PdfWorkspaceDocumentMeta } from './pdfWorkspaceAnchors'

export type PdfWorkspaceDocsResponse = { ok: true; index: PdfWorkspaceIndex } | { ok: false; error: string }

export type PdfWorkspaceImportOk = {
  ok: true
  docId: string
  mode: PdfConversionMode
  name: string
  artifacts: { mdRelPath: string; anchorMapRelPath: string; reportRelPath: string }
}
export type PdfWorkspaceImportErr = { ok: false; error: string }
export type PdfWorkspaceImportResponse = PdfWorkspaceImportOk | PdfWorkspaceImportErr

export type PdfWorkspaceDocResponse =
  | { ok: true; docId: string; mode: PdfConversionMode; meta: PdfWorkspaceDocumentMeta | null; markdown: string; anchorMap: PdfWorkspaceAnchorMap }
  | { ok: false; error: string }

const readJson = async <T>(res: Response): Promise<T | null> => {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const getDefaultWorkspaceOutputDirRel = (): string => {
  return PDF_WORKSPACE_DIR_REL_DEFAULT
}

export async function listPdfWorkspaceDocs(args?: { outputDirRel?: string }): Promise<PdfWorkspaceDocsResponse> {
  const outputDirRel = String(args?.outputDirRel || PDF_WORKSPACE_DIR_REL_DEFAULT).trim() || PDF_WORKSPACE_DIR_REL_DEFAULT
  const qs = new URLSearchParams({ outputDirRel })
  const res = await fetch(`${PDF_WORKSPACE_API.docs}?${qs.toString()}`, { headers: { Accept: 'application/json' } })
  const json = await readJson<PdfWorkspaceDocsResponse>(res)
  if (json) return json
  return { ok: false, error: `HTTP ${res.status}` }
}

export async function importPdfToWorkspace(args: {
  file: File
  conversionMode: PdfConversionMode
  outputDirRel?: string
}): Promise<PdfWorkspaceImportResponse> {
  const outputDirRel = String(args.outputDirRel || PDF_WORKSPACE_DIR_REL_DEFAULT).trim() || PDF_WORKSPACE_DIR_REL_DEFAULT
  const qs = new URLSearchParams({ outputDirRel, conversionMode: args.conversionMode })
  const body = await args.file.arrayBuffer()
  const res = await fetch(`${PDF_WORKSPACE_API.import}?${qs.toString()}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/pdf',
      'X-Import-Filename': args.file.name || '',
    },
    body,
  })
  const json = await readJson<PdfWorkspaceImportResponse>(res)
  if (json) return json
  return { ok: false, error: `HTTP ${res.status}` }
}

export async function fetchPdfWorkspaceDoc(args: {
  docId: string
  mode: PdfConversionMode
  outputDirRel?: string
}): Promise<PdfWorkspaceDocResponse> {
  const outputDirRel = String(args.outputDirRel || PDF_WORKSPACE_DIR_REL_DEFAULT).trim() || PDF_WORKSPACE_DIR_REL_DEFAULT
  const qs = new URLSearchParams({ outputDirRel, mode: args.mode })
  const res = await fetch(`${PDF_WORKSPACE_API.doc(args.docId)}?${qs.toString()}`, { headers: { Accept: 'application/json' } })
  const json = await readJson<PdfWorkspaceDocResponse>(res)
  if (json) return json
  return { ok: false, error: `HTTP ${res.status}` }
}

