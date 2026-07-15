import fs from 'node:fs/promises'
import path from 'node:path'
import type { WebsiteImportManifestV1 } from './websiteImportTypes'

const safeId = (raw: unknown): string | null => {
  const value = String(raw || '').trim()
  return value && value.length <= 160 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null
}

const sendJsonError = (res: import('node:http').ServerResponse, statusCode: number, error: string) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: false, error }))
}

export async function handleWebsiteImportArtifact(args: {
  workspaceAbs: string
  parsed: URL
  res: import('node:http').ServerResponse
  readManifest: (filePath: string) => Promise<WebsiteImportManifestV1 | null>
}): Promise<void> {
  const { workspaceAbs, parsed, res } = args
  const importId = safeId(parsed.searchParams.get('importId'))
  const nodeId = safeId(parsed.searchParams.get('nodeId'))
  const kind = String(parsed.searchParams.get('kind') || '').trim()
  if (!importId || !nodeId || !kind) return sendJsonError(res, 400, 'Missing importId, nodeId, or kind')

  const dirAbs = path.join(workspaceAbs, importId, 'nodes', nodeId)
  let fileAbs = ''
  let contentType = 'application/octet-stream'
  let downloadName = ''
  if (kind === 'download') {
    const downloadId = safeId(parsed.searchParams.get('downloadId'))
    if (!downloadId) return sendJsonError(res, 400, 'Missing downloadId')
    const manifest = await args.readManifest(path.join(workspaceAbs, importId, 'manifest.json'))
    const artifact = manifest?.nodes.find(node => node.nodeId === nodeId)?.artifacts.downloads?.find(item => item.id === downloadId)
    if (!artifact || path.basename(artifact.storedFileName) !== artifact.storedFileName) return sendJsonError(res, 404, 'Not found')
    fileAbs = path.join(dirAbs, 'downloads', artifact.storedFileName)
    contentType = artifact.mimeType || contentType
    downloadName = artifact.fileName
  } else if (kind === 'rawHtml' || kind === 'markdown' || kind === 'conversionJson') {
    fileAbs = kind === 'rawHtml'
      ? path.join(dirAbs, 'raw.html')
      : kind === 'markdown'
        ? path.join(dirAbs, 'page.md')
        : path.join(dirAbs, 'conversion.json')
    contentType = kind === 'rawHtml'
      ? 'text/html; charset=utf-8'
      : kind === 'conversionJson'
        ? 'application/json; charset=utf-8'
        : 'text/plain; charset=utf-8'
    if (kind === 'rawHtml' && parsed.searchParams.get('download') === '1') downloadName = 'page.html'
  } else {
    return sendJsonError(res, 400, 'Invalid kind')
  }

  try {
    const bytes = await fs.readFile(fileAbs)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/["\\\r\n]/g, '_')}"`)
    res.end(bytes)
  } catch {
    sendJsonError(res, 404, 'Not found')
  }
}
