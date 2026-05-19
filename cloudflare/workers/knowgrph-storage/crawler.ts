import {
  CLOUDFLARE_PAY_PER_CRAWL_DOC_URL,
  CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS,
  CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS,
  KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS,
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  buildKnowgrphStorageDocPath,
  buildKnowgrphStorageExportPath,
  buildKnowgrphStorageLlmsPath,
  buildKnowgrphStorageSourceFilesIndexPath,
} from './contract'
import {
  type D1DatabaseLike,
  normalizeNumber,
  normalizeString,
  queryAll,
} from './db'

type CrawlerDocumentRow = {
  id: string
  canonical_path: string
  title: string | null
  doc_type: string | null
  content_hash: string
  revision: number
  updated_at: string
  content_length?: number
}

type CrawlerDocument = {
  id: string
  canonicalPath: string
  title: string
  docType: string
  contentHash: string
  revision: number
  updatedAt: string
  contentLength: number
}

type CrawlerRoute = {
  workspaceId: string
  format: 'index' | 'llms'
}

const SOURCE_FILES_LLM_SUFFIX = '/llms.txt'

const decodeRouteSegment = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

const escapeMarkdownText = (value: unknown): string =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .trim()

const code = (value: unknown): string =>
  `\`${String(value || '').replace(/`/g, '\\`').trim()}\``

const absoluteUrl = (requestUrl: string, path: string): string =>
  new URL(path, requestUrl).toString()

const readCrawlerRoute = (pathname: string): CrawlerRoute | null => {
  if (pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesLlms) {
    return { workspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID, format: 'llms' }
  }
  if (pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndex) {
    return { workspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID, format: 'index' }
  }
  if (!pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndexPrefix)) return null
  const suffix = pathname.slice(KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndexPrefix.length)
  const format = suffix.endsWith(SOURCE_FILES_LLM_SUFFIX) ? 'llms' : 'index'
  const workspaceSegment = format === 'llms'
    ? suffix.slice(0, -SOURCE_FILES_LLM_SUFFIX.length)
    : suffix
  const normalizedWorkspaceSegment = workspaceSegment.replace(/\/+$/, '')
  if (!normalizedWorkspaceSegment || normalizedWorkspaceSegment.includes('/')) return null
  const workspaceId = normalizeString(decodeRouteSegment(normalizedWorkspaceSegment))
  if (!workspaceId) return null
  return { workspaceId, format }
}

export const isKnowgrphStorageCrawlerRoute = (pathname: string): boolean =>
  readCrawlerRoute(pathname) !== null

const readCrawlerDocuments = async (
  db: D1DatabaseLike,
  workspaceId: string,
): Promise<CrawlerDocument[]> => {
  const rows = await queryAll<CrawlerDocumentRow>(
    db,
    `SELECT id, canonical_path, title, doc_type, content_hash, revision, updated_at,
            length(COALESCE(content_md, '')) AS content_length
     FROM documents
     WHERE workspace_id = ? AND deleted = 0
     ORDER BY canonical_path ASC, id ASC`,
    [workspaceId],
  )
  return rows
    .map(row => {
      const canonicalPath = normalizeString(row.canonical_path)
      const title = normalizeString(row.title) || canonicalPath.split('/').filter(Boolean).slice(-1)[0] || normalizeString(row.id)
      return {
        id: normalizeString(row.id),
        canonicalPath,
        title,
        docType: normalizeString(row.doc_type) || 'markdown',
        contentHash: normalizeString(row.content_hash),
        revision: normalizeNumber(row.revision),
        updatedAt: normalizeString(row.updated_at),
        contentLength: normalizeNumber(row.content_length),
      }
    })
    .filter(row => row.id && row.canonicalPath)
}

const buildCrawlerHeaders = (contentType: string, corsHeaders: Record<string, string>): HeadersInit => ({
  'content-type': contentType,
  'cache-control': 'public, max-age=60, must-revalidate',
  'link': `<${CLOUDFLARE_PAY_PER_CRAWL_DOC_URL}>; rel="help"; title="Cloudflare AI Crawl Control Pay Per Crawl"`,
  'x-robots-tag': 'all',
  [KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.source]: 'd1-documents-doc-view',
  [KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.payPerCrawlPolicy]: 'cloudflare-zone-policy',
  ...corsHeaders,
})

const appendAccessPolicyLines = (lines: string[]): void => {
  lines.push(
    '## Access Policy',
    '',
    '- Source Files are read from the D1-backed storage document rows and markdown doc-view route.',
    '- Cloudflare AI Crawl Control Pay Per Crawl, when enabled on the zone, owns payment negotiation before crawler-visible content is served.',
    `- Unpaid crawler requests can receive HTTP 402 with ${code(CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.price)}; successful paid access can receive HTTP 200 with ${code(CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.charged)}.`,
    `- AI crawler payment intent can use ${code(CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS.exactPrice)} or ${code(CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS.maxPrice)} when those headers are signed through Cloudflare Web Bot Auth.`,
    `- Cloudflare can return ${code(CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.error)} when paid crawler access is rejected.`,
    '- This Worker does not emulate payment headers, prices, or crawler identity. It only exposes neutral read-only Source Files content and metadata.',
    `- Pay Per Crawl reference: ${CLOUDFLARE_PAY_PER_CRAWL_DOC_URL}`,
    '',
  )
}

const buildSourceFilesIndexMarkdown = (args: {
  requestUrl: string
  workspaceId: string
  exportedAtIso: string
  documents: CrawlerDocument[]
}): string => {
  const indexUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageSourceFilesIndexPath(args.workspaceId))
  const llmsUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageLlmsPath(args.workspaceId))
  const exportUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageExportPath(args.workspaceId))
  const lines = [
    '# Knowgrph Source Files',
    '',
    `Workspace: ${code(args.workspaceId)}`,
    `Generated: ${code(args.exportedAtIso)}`,
    `Documents: ${args.documents.length}`,
    '',
  ]
  appendAccessPolicyLines(lines)
  lines.push(
    '## Crawler Entry Points',
    '',
    `- [Source Files index](${indexUrl})`,
    `- [LLM text](${llmsUrl})`,
    `- [Storage export JSON](${exportUrl})`,
    '',
    '## Source Files',
    '',
  )
  if (args.documents.length === 0) {
    lines.push('- No Source Files are currently published for this workspace.')
    return `${lines.join('\n')}\n`
  }
  for (const document of args.documents) {
    const docUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageDocPath(args.workspaceId, document.canonicalPath))
    lines.push(`- [${escapeMarkdownText(document.title)}](${docUrl})`)
    lines.push(`  - canonicalPath: ${code(document.canonicalPath)}`)
    lines.push(`  - contentHash: ${code(document.contentHash)}`)
    lines.push(`  - revision: ${document.revision}`)
    lines.push(`  - updatedAt: ${code(document.updatedAt)}`)
    lines.push(`  - contentLength: ${document.contentLength}`)
  }
  return `${lines.join('\n')}\n`
}

const buildSourceFilesLlmsText = (args: {
  requestUrl: string
  workspaceId: string
  exportedAtIso: string
  documents: CrawlerDocument[]
}): string => {
  const indexUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageSourceFilesIndexPath(args.workspaceId))
  const lines = [
    '# Knowgrph Source Files',
    '',
    '> Markdown Source Files from the Knowgrph Editor Workspace storage boundary.',
    '',
    `Workspace: ${args.workspaceId}`,
    `Generated: ${args.exportedAtIso}`,
    `Index: ${indexUrl}`,
    '',
  ]
  appendAccessPolicyLines(lines)
  lines.push('## Documents', '')
  if (args.documents.length === 0) {
    lines.push('- No Source Files are currently published for this workspace.')
    return `${lines.join('\n')}\n`
  }
  for (const document of args.documents) {
    const docUrl = absoluteUrl(args.requestUrl, buildKnowgrphStorageDocPath(args.workspaceId, document.canonicalPath))
    lines.push(`- ${document.title}: ${docUrl}`)
  }
  return `${lines.join('\n')}\n`
}

export const handleCrawlerSourceFiles = async (
  request: Request,
  db: D1DatabaseLike,
  corsHeaders: Record<string, string>,
): Promise<Response | null> => {
  const url = new URL(request.url)
  const route = readCrawlerRoute(url.pathname)
  if (!route) return null
  const nowIso = new Date().toISOString()
  const documents = await readCrawlerDocuments(db, route.workspaceId)
  const body = route.format === 'llms'
    ? buildSourceFilesLlmsText({ requestUrl: request.url, workspaceId: route.workspaceId, exportedAtIso: nowIso, documents })
    : buildSourceFilesIndexMarkdown({ requestUrl: request.url, workspaceId: route.workspaceId, exportedAtIso: nowIso, documents })
  const contentType = route.format === 'llms'
    ? 'text/plain; charset=utf-8'
    : 'text/markdown; charset=utf-8'
  return new Response(body, { status: 200, headers: buildCrawlerHeaders(contentType, corsHeaders) })
}
