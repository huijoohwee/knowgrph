import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { convertPdfFileToMarkdown } from '@/lib/pdf/native/nativePdfToMarkdownNode'
import { normalizePdfExtractedMarkdown } from '@/lib/pdf/normalizePdfExtractedMarkdown'

function makeMinimalPdfWithText(text: string): Buffer {
  const safe = String(text || '').replace(/[()\\]/g, m => `\\${m}`)
  const parts = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    'endobj',
    '4 0 obj',
    `<< /Length ${safe.length + 64} >>`,
    'stream',
    `BT /F1 24 Tf 72 720 Td (${safe}) Tj ET`,
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
    '%%EOF',
    '',
  ]
  return Buffer.from(parts.join('\n'), 'latin1')
}

async function tryResolvePdfFixturePath(): Promise<string | null> {
  const env = String(process.env.KG_TEST_PDF_FIXTURE_PATH || '').trim()
  if (env) {
    try {
      const st = await fs.stat(env)
      if (st.isFile() && st.size > 0) return env
    } catch {
      void 0
    }
  }
  const dir = path.resolve(process.cwd(), '..', '..', 'sandbox', 'test-data')
  try {
    const entries = await fs.readdir(dir)
    const pdfs = entries.filter(name => String(name || '').toLowerCase().endsWith('.pdf'))
    let best: { path: string; size: number } | null = null
    for (const name of pdfs) {
      const p = path.join(dir, name)
      try {
        const st = await fs.stat(p)
        if (!st.isFile() || st.size <= 0) continue
        if (!best || st.size > best.size) best = { path: p, size: st.size }
      } catch {
        void 0
      }
    }
    return best?.path || null
  } catch {
    return null
  }
}

export async function testPdfNativeConversionExtractsBasicText() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kg-pdf-native-'))
  const pdfPath = path.join(tmpDir, 'simple.pdf')
  try {
    await fs.writeFile(pdfPath, makeMinimalPdfWithText('Hello PDF World'))
    const res = await convertPdfFileToMarkdown({ pdfPath, title: 'simple.pdf' })
    const md = normalizePdfExtractedMarkdown(res.markdown)
    if (!md.includes('# simple.pdf')) throw new Error('expected markdown title')
    if (!md.includes('## Page 1')) throw new Error('expected page heading')
    if (!md.includes('Hello PDF World')) throw new Error('expected extracted text')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

export async function testPdfNativeConversionAvoidsSpacedLetterArtifactsOnFixture() {
  const pdfPath = await tryResolvePdfFixturePath()
  if (!pdfPath) return
  const res = await convertPdfFileToMarkdown({ pdfPath, title: path.basename(pdfPath) })
  const md = normalizePdfExtractedMarkdown(res.markdown)
  if (!md.includes('## Page')) throw new Error('expected at least one page section')
  const spacedRun = /(?:^|[^A-Za-z0-9])[A-Za-z](?:\s+[A-Za-z]){4,}(?:$|[^A-Za-z0-9])/m
  if (spacedRun.test(md)) throw new Error('expected no spaced-letter artifacts in normalized markdown')
  if (md.length < 200) throw new Error('expected non-trivial markdown output')
}
