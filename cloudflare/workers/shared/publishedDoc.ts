import {
  CLOUDFLARE_PAY_PER_CRAWL_DOC_URL,
  KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS,
} from '../../../canvas/src/lib/storage/knowgrphStorageSyncContract.ts'
import { normalizeString, queryAll, queryFirst, type D1DatabaseLike } from './d1.ts'

type PublishedDocRow = {
  id: string
  content_md: string
}

type PublishedDocChunkRow = {
  id: string
  chunk_order: number
  markdown: string
}

export const KNOWGRPH_STORAGE_DOC_VIEW_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'public, max-age=60, must-revalidate',
  'link': `<${CLOUDFLARE_PAY_PER_CRAWL_DOC_URL}>; rel="help"; title="Cloudflare AI Crawl Control Pay Per Crawl"`,
  'x-robots-tag': 'all',
  [KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.source]: 'd1-documents-doc-view',
  [KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.payPerCrawlPolicy]: 'cloudflare-zone-policy',
}

export const readPublishedMarkdown = async (
  db: D1DatabaseLike,
  args: { workspaceId: string; canonicalPath: string },
): Promise<string | null> => {
  const workspaceId = normalizeString(args.workspaceId)
  const canonicalPath = normalizeString(args.canonicalPath)
  if (!workspaceId || !canonicalPath) return null
  const row = await queryFirst<PublishedDocRow>(
    db,
    'SELECT id, content_md FROM documents WHERE workspace_id = ? AND canonical_path = ? AND deleted = 0',
    [workspaceId, canonicalPath],
  )
  if (!row) return null
  let contentMarkdown = typeof row.content_md === 'string' ? row.content_md : ''
  if (contentMarkdown.trim()) return contentMarkdown
  const documentId = normalizeString(row.id)
  if (!documentId) return ''
  const chunks = await queryAll<PublishedDocChunkRow>(
    db,
    `SELECT id, chunk_order, markdown
     FROM document_chunks
     WHERE workspace_id = ? AND document_id = ?
     ORDER BY chunk_order ASC, id ASC`,
    [workspaceId, documentId],
  )
  return chunks
    .map(chunk => normalizeString(chunk.markdown) ? String(chunk.markdown) : '')
    .filter(Boolean)
    .join('\n\n')
}
