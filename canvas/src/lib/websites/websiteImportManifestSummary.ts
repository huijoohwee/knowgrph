export type WebsiteImportManifestSummary = {
  importId: string
  processedPages: number
  successfulPages: number
  errorPages: number
  storedFiles: number
}

type SummaryManifestNode = {
  status?: unknown
  artifacts?: Record<string, unknown>
}

export function buildWebsiteImportManifestSummary(manifest: {
  importId: string
  nodes?: readonly SummaryManifestNode[]
  progress?: { processed?: number; ok?: number; error?: number }
  errors?: readonly unknown[]
}): WebsiteImportManifestSummary {
  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : []
  let storedFiles = 1
  for (const node of nodes) {
    const artifacts = node?.artifacts || {}
    for (const key of ['rawHtmlRelPath', 'markdownRelPath', 'conversionJsonRelPath'] as const) {
      if (typeof artifacts[key] === 'string' && String(artifacts[key]).trim()) storedFiles += 1
    }
    if (Array.isArray(artifacts.downloads)) storedFiles += artifacts.downloads.length
  }
  const successfulPages = typeof manifest.progress?.ok === 'number'
    ? manifest.progress.ok
    : nodes.filter(node => String(node.status || '') === 'ok').length
  const errorPages = typeof manifest.progress?.error === 'number'
    ? manifest.progress.error
    : Math.max(nodes.filter(node => String(node.status || '') === 'error').length, manifest.errors?.length || 0)
  const processedPages = typeof manifest.progress?.processed === 'number'
    ? manifest.progress.processed
    : successfulPages + errorPages
  return { importId: manifest.importId, processedPages, successfulPages, errorPages, storedFiles }
}
