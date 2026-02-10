import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { convertPdfToMarkdown } from './pdfConvertServer'
import {
  PDF_WORKSPACE_INDEX_VERSION,
  type PdfConversionMode,
  type PdfWorkspaceDocumentMeta,
  type PdfWorkspaceIndex,
  buildAnchorMapFromMarkdown,
} from '../pdfWorkspaceAnchors'
import { PDF_WORKSPACE_DIR_REL_DEFAULT } from '../pdfWorkspaceConfig'

const isPdfConversionMode = (raw: string): raw is PdfConversionMode => raw === 'text-only' || raw === 'image-heavy' || raw === 'scan-ocr'

const normalizeRel = (raw: string): string => String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')

const resolveWorkspaceRoot = (args: { repoRoot: string; outputDirRel?: string | null }): { ok: true; abs: string; rel: string } | { ok: false; error: string } => {
  const fallbackRel = PDF_WORKSPACE_DIR_REL_DEFAULT
  const relRaw = normalizeRel(args.outputDirRel || fallbackRel) || fallbackRel
  const normalized = path.posix.normalize(relRaw)
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return { ok: false, error: 'Missing outputDirRel' }
  if (parts[0] !== '.knowgrph-workspace') return { ok: false, error: 'outputDirRel must be under .knowgrph-workspace' }
  if (normalized.startsWith('..') || normalized.includes('/../')) return { ok: false, error: 'Invalid outputDirRel' }
  const abs = path.resolve(args.repoRoot, normalized)
  const rootResolved = path.resolve(args.repoRoot)
  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) return { ok: false, error: 'outputDirRel escapes repo root' }
  return { ok: true, abs, rel: normalized }
}

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const writeJsonFileAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${filePath}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}

const nowMs = () => Date.now()

const titleFromName = (nameHint: string): string => {
  const raw = String(nameHint || '').trim()
  if (!raw) return 'document.pdf'
  return raw
}

const readBodyAsPdf = async (req: import('http').IncomingMessage): Promise<Buffer | null> => {
  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''
  if (!contentType.toLowerCase().startsWith('application/pdf')) return null
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const modeOverrides = (mode: PdfConversionMode) => {
  if (mode === 'image-heavy') {
    return {
      includeImages: true,
      embedImages: false,
      maxExtractedImagesPerPage: 16,
      maxEmbeddedImagesPerPage: 0,
      maxEmbeddedTotalBytes: 0,
      maxEmbeddedAssetBytes: 0,
      deepseekOcr2Enabled: false,
      deepseekOcr2Mode: 'fallback' as const,
    }
  }
  if (mode === 'scan-ocr') {
    return {
      includeImages: false,
      embedImages: false,
      maxExtractedImagesPerPage: 4,
      maxEmbeddedImagesPerPage: 0,
      maxEmbeddedTotalBytes: 4 * 1024 * 1024,
      maxEmbeddedAssetBytes: 2 * 1024 * 1024,
      deepseekOcr2Enabled: true,
      deepseekOcr2Mode: 'always' as const,
    }
  }
  return {
    includeImages: false,
    embedImages: false,
    maxExtractedImagesPerPage: 0,
    maxEmbeddedImagesPerPage: 0,
    maxEmbeddedTotalBytes: 4 * 1024 * 1024,
    maxEmbeddedAssetBytes: 2 * 1024 * 1024,
    deepseekOcr2Enabled: false,
    deepseekOcr2Mode: 'fallback' as const,
  }
}

const readIndex = async (workspaceAbs: string): Promise<PdfWorkspaceIndex> => {
  const p = path.join(workspaceAbs, 'index.json')
  const existing = await readJsonFile<PdfWorkspaceIndex>(p)
  if (existing && existing.version === PDF_WORKSPACE_INDEX_VERSION && Array.isArray(existing.docs)) return existing
  return { version: PDF_WORKSPACE_INDEX_VERSION, docs: [] }
}

const writeIndex = async (workspaceAbs: string, idx: PdfWorkspaceIndex): Promise<void> => {
  const p = path.join(workspaceAbs, 'index.json')
  await writeJsonFileAtomic(p, idx)
}

const upsertDocMeta = (idx: PdfWorkspaceIndex, next: PdfWorkspaceDocumentMeta): PdfWorkspaceIndex => {
  const docs = Array.isArray(idx.docs) ? idx.docs.slice() : []
  const pos = docs.findIndex(d => d && d.docId === next.docId)
  if (pos >= 0) docs[pos] = next
  else docs.push(next)
  docs.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
  return { version: PDF_WORKSPACE_INDEX_VERSION, docs }
}

export function createPdfWorkspaceHandler(args: { repoRoot: string }): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    const rawUrl = String(req.url || '')
    if (!rawUrl.startsWith('/__pdf_workspace')) {
      next()
      return
    }
    const base = `http://${req.headers.host || 'localhost'}`
    const parsed = new URL(rawUrl, base)
    const pathname = parsed.pathname
    const workspaceResolved = resolveWorkspaceRoot({ repoRoot: args.repoRoot, outputDirRel: parsed.searchParams.get('outputDirRel') })
    if (workspaceResolved.ok !== true) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: workspaceResolved.error }))
      return
    }
    const workspaceAbs = workspaceResolved.abs

    if (req.method === 'GET' && pathname === '/__pdf_workspace/docs') {
      const idx = await readIndex(workspaceAbs)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, index: idx }))
      return
    }

    if (req.method === 'POST' && pathname === '/__pdf_workspace/import') {
      const modeRaw = String(parsed.searchParams.get('conversionMode') || '').trim()
      const mode: PdfConversionMode = isPdfConversionMode(modeRaw) ? modeRaw : 'text-only'
      const docId = String(parsed.searchParams.get('docId') || '').trim() || randomUUID()
      const nameHint = typeof req.headers['x-import-filename'] === 'string' ? req.headers['x-import-filename'] : ''
      const pdfBytes = await readBodyAsPdf(req)
      if (!pdfBytes) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Expected application/pdf body' }))
        return
      }

      const converted = await convertPdfToMarkdown({
        body: pdfBytes,
        nameHint,
        overrides: modeOverrides(mode),
      })
      if (!converted.ok) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(converted))
        return
      }

      const markdown = String(converted.markdown || '')
      const anchorMap = buildAnchorMapFromMarkdown({ docId, mode, markdown })

      const docDirAbs = path.join(workspaceAbs, docId)
      const modeDirAbs = path.join(docDirAbs, 'modes', mode)
      await fs.mkdir(modeDirAbs, { recursive: true })

      const mdPathAbs = path.join(modeDirAbs, 'output.md')
      const anchorPathAbs = path.join(modeDirAbs, 'anchor-map.json')
      const reportPathAbs = path.join(modeDirAbs, 'conversion-report.json')
      await fs.writeFile(mdPathAbs, markdown, 'utf8')
      await writeJsonFileAtomic(anchorPathAbs, anchorMap)
      await writeJsonFileAtomic(reportPathAbs, {
        ok: true,
        docId,
        mode,
        name: converted.name,
        createdAtMs: nowMs(),
      })

      const docMetaPathAbs = path.join(docDirAbs, 'document.json')
      const prevMeta = await readJsonFile<PdfWorkspaceDocumentMeta>(docMetaPathAbs)
      const createdAtMs = prevMeta?.createdAtMs && Number.isFinite(prevMeta.createdAtMs) ? prevMeta.createdAtMs : nowMs()
      const meta: PdfWorkspaceDocumentMeta = {
        docId,
        title: titleFromName(nameHint || converted.name),
        sourceName: String(nameHint || converted.name || 'document.pdf').trim() || 'document.pdf',
        createdAtMs,
        updatedAtMs: nowMs(),
        lastMode: mode,
      }
      await writeJsonFileAtomic(docMetaPathAbs, meta)

      const idx = upsertDocMeta(await readIndex(workspaceAbs), meta)
      await writeIndex(workspaceAbs, idx)

      const relBase = workspaceResolved.rel
      const relDoc = path.posix.join(relBase, docId, 'modes', mode)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          ok: true,
          docId,
          mode,
          name: converted.name,
          artifacts: {
            mdRelPath: `${relDoc}/output.md`,
            anchorMapRelPath: `${relDoc}/anchor-map.json`,
            reportRelPath: `${relDoc}/conversion-report.json`,
          },
        }),
      )
      return
    }

    if (req.method === 'GET' && pathname.startsWith('/__pdf_workspace/doc/')) {
      const parts = pathname.split('/').filter(Boolean)
      const docId = parts.length >= 3 ? decodeURIComponent(parts[2] || '') : ''
      if (!docId) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing docId' }))
        return
      }
      const modeRaw = String(parsed.searchParams.get('mode') || parsed.searchParams.get('conversionMode') || '').trim()
      const mode: PdfConversionMode = isPdfConversionMode(modeRaw) ? modeRaw : 'text-only'
      const docDirAbs = path.join(workspaceAbs, docId)
      const meta = await readJsonFile<PdfWorkspaceDocumentMeta>(path.join(docDirAbs, 'document.json'))
      const modeDirAbs = path.join(docDirAbs, 'modes', mode)
      const markdown = await fs
        .readFile(path.join(modeDirAbs, 'output.md'), 'utf8')
        .then(s => String(s))
        .catch(() => '')
      const anchorMap = (await readJsonFile(path.join(modeDirAbs, 'anchor-map.json'))) as unknown
      if (!markdown || !anchorMap) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Artifacts not found' }))
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, docId, mode, meta, markdown, anchorMap }))
      return
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Not found' }))
  }
}
