import {
  buildSpreadsheetArtifactFromMarkdown,
  MARKDOWN_SPREADSHEET_MIME_TYPE,
  type ParsedMarkdownPipeTable,
} from 'grph-shared/office/markdownOfficeArtifacts'

export const FINANCIAL_MODEL_WORKBOOK_MIME_TYPE = MARKDOWN_SPREADSHEET_MIME_TYPE

export type FinancialModelWorkbookInput = {
  markdown: string
  sheetName?: string
}

export type FinancialModelWorkbookArtifact = {
  bytes: Uint8Array<ArrayBuffer>
  blob: Blob
  mimeType: typeof FINANCIAL_MODEL_WORKBOOK_MIME_TYPE
  sheetName: string
  table: ParsedMarkdownPipeTable
}

/** Build a deterministic OOXML companion while keeping Markdown authoritative. */
export const buildFinancialModelWorkbookFromMarkdown = (
  input: FinancialModelWorkbookInput,
): FinancialModelWorkbookArtifact => {
  const artifact = buildSpreadsheetArtifactFromMarkdown(input)
  return {
    ...artifact,
    blob: new Blob([artifact.bytes], { type: FINANCIAL_MODEL_WORKBOOK_MIME_TYPE }),
  }
}
