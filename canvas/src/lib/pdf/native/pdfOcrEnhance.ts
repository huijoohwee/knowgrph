import { deepseekOcr2InferImageToMarkdown } from '../../ocr/deepseekOcr2Client'
import { shiftMarkdownHeadings } from '../../markdown/shiftMarkdownHeadings'
import type { NativePdfAsset, TextFragment } from './types'

export type PdfOcrEnhanceConfig = {
  enabled: boolean
  endpoint: string
  prompt?: string
  mode?: 'fallback' | 'always'
  minTextChars?: number
  maxImagesPerPage?: number
  timeoutMs?: number
}

export async function maybeEnhancePageWithOcr(args: {
  pageIndex: number
  textFragments: TextFragment[]
  imageAssets: NativePdfAsset[]
  config: PdfOcrEnhanceConfig | null
}): Promise<string | null> {
  const cfg = args.config
  if (!cfg || !cfg.enabled) return null

  const endpoint = String(cfg.endpoint || '').trim()
  if (!endpoint) return null

  const mode = cfg.mode === 'always' ? 'always' : 'fallback'
  const minTextChars = (() => {
    const n = cfg.minTextChars
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 180
    return Math.max(0, Math.min(50_000, Math.floor(n)))
  })()
  const maxImagesPerPage = (() => {
    const n = cfg.maxImagesPerPage
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 1
    return Math.max(1, Math.min(6, Math.floor(n)))
  })()

  const textChars = args.textFragments.reduce((sum, f) => sum + String(f.text || '').trim().length, 0)
  if (mode === 'fallback' && textChars >= minTextChars) return null
  if (!args.imageAssets || args.imageAssets.length === 0) return null

  const candidates = args.imageAssets
    .slice()
    .sort((a, b) => (b.bytes?.length || 0) - (a.bytes?.length || 0))
    .slice(0, maxImagesPerPage)

  const results: string[] = []
  for (const img of candidates) {
    const res = await deepseekOcr2InferImageToMarkdown({
      endpoint,
      imageBytes: img.bytes,
      filename: img.filename,
      prompt: cfg.prompt,
      timeoutMs: cfg.timeoutMs,
    })
    if (!res.ok) continue
    const shifted = shiftMarkdownHeadings({ markdown: res.markdown, delta: 2 })
    const cleaned = shifted.trim()
    if (!cleaned) continue
    results.push(cleaned)
    if (results.length >= 1) break
  }

  if (results.length === 0) return null
  return results.join('\n\n')
}
