export type MarkdownSourceFilesIngestIntegration = {
  onImportLocal: (args: { fileId: string | null }) => void | Promise<void>
  onImportUrl: (args: { fileId: string | null; url: string; format?: 'markdown' | 'json' }) => void | Promise<void>
  onExport: (args: { fileId: string | null }) => void
  onClear: (args: { fileId: string | null }) => void
}

