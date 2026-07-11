export const KNOWGRPH_MARKDOWN_CONTENT_MANIFEST_SCHEMA = 'knowgrph-markdown-content-manifest/v1'
export const KNOWGRPH_MARKDOWN_CONTENT_MANIFEST_PATH = '/api/storage/content-manifest.json'
export const KNOWGRPH_MARKDOWN_CONTENT_MANIFEST_SUFFIX = '/content-manifest.json'

export const buildKnowgrphMarkdownContentManifestPath = (workspaceId?: string | null): string => {
  const normalizedWorkspaceId = String(workspaceId || '').trim()
  return normalizedWorkspaceId
    ? `/api/storage/source-files/${encodeURIComponent(normalizedWorkspaceId)}${KNOWGRPH_MARKDOWN_CONTENT_MANIFEST_SUFFIX}`
    : KNOWGRPH_MARKDOWN_CONTENT_MANIFEST_PATH
}
