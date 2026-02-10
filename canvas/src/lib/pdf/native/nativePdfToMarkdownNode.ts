import fs from 'node:fs/promises'
import path from 'node:path'
import type { NativePdfAsset } from './types'
import { buildMarkdownForPage } from './pdfMarkdown'
import { extractTextFragmentsFromPage } from './pdfTextExtraction'
import { extractPageImages } from './pdfImages'
import type { PdfOcrEnhanceConfig } from './pdfOcrEnhance'
import { maybeEnhancePageWithOcr } from './pdfOcrEnhance'
import type { PdfDict, PdfRef } from './pdfObjects'
import { createPdfStreamDecodeCache, deref, expandObjectStreams, getDictValue, isArray, isDict, isName, isNumber, isRef, parseIndirectObjects, readStream } from './pdfObjects'

export async function convertPdfFileToMarkdown(args: {
  pdfPath: string
  title: string
  assetUrlPrefix?: string
  includeImages?: boolean
  maxPages?: number
  maxExtractedImagesPerPage?: number
  maxEmbeddedImagesPerPage?: number
  ocrEnhance?: PdfOcrEnhanceConfig | null
  streamDecodeCacheMaxBytes?: number
}): Promise<{ markdown: string; assets: NativePdfAsset[] }> {
  const buf = await fs.readFile(args.pdfPath)
  return await convertPdfBytesToMarkdown({
    pdfBytes: buf,
    title: args.title,
    assetUrlPrefix: args.assetUrlPrefix,
    includeImages: args.includeImages,
    maxPages: args.maxPages,
    maxExtractedImagesPerPage: args.maxExtractedImagesPerPage,
    maxEmbeddedImagesPerPage: args.maxEmbeddedImagesPerPage,
    ocrEnhance: args.ocrEnhance,
    streamDecodeCacheMaxBytes: args.streamDecodeCacheMaxBytes,
  })
}

export async function convertPdfBytesToMarkdown(args: {
  pdfBytes: Buffer
  title: string
  assetUrlPrefix?: string
  includeImages?: boolean
  maxPages?: number
  maxExtractedImagesPerPage?: number
  maxEmbeddedImagesPerPage?: number
  ocrEnhance?: PdfOcrEnhanceConfig | null
  streamDecodeCacheMaxBytes?: number
}): Promise<{ markdown: string; assets: NativePdfAsset[] }> {
  const objects = parseIndirectObjects(args.pdfBytes)
  const streamDecodeCache = createPdfStreamDecodeCache(typeof args.streamDecodeCacheMaxBytes === 'number' ? args.streamDecodeCacheMaxBytes : 0)
  expandObjectStreams(objects, streamDecodeCache)

  const catalogRef = (() => {
    for (const obj of objects.values()) {
      const t = getDictValue(obj.dict, 'Type')
      if (isName(t) && t.name === 'Catalog') return { obj: obj.obj, gen: obj.gen }
    }
    return null
  })()

  const catalog = catalogRef ? objects.get(catalogRef.obj)?.dict || null : null
  const pagesRef = (() => {
    const v = catalog ? getDictValue(catalog, 'Pages') : null
    return isRef(v) ? v : null
  })()

  const pages: { ref: PdfRef; resources: PdfDict | null; mediaBox: number[] | null; rotate: number }[] = []
  const walkPages = (ref: PdfRef | null, inherited: { resources: PdfDict | null; mediaBox: number[] | null; rotate: number }, depth = 0) => {
    if (!ref || depth > 50) return
    const dict = objects.get(ref.obj)?.dict || null
    if (!dict) return
    const t = getDictValue(dict, 'Type')
    const typeName = isName(t) ? t.name : ''
    const resources = (() => {
      const v = getDictValue(dict, 'Resources')
      const d = deref(objects, v)
      return isDict(d) ? d : inherited.resources
    })()
    const mediaBox = (() => {
      const v = getDictValue(dict, 'MediaBox')
      const d = deref(objects, v)
      if (isArray(d)) {
        const nums = d.items.filter(isNumber).map(n => n.value)
        if (nums.length >= 4) return nums.slice(0, 4)
      }
      return inherited.mediaBox
    })()
    const rotate = (() => {
      const v = getDictValue(dict, 'Rotate')
      if (isNumber(v)) return Math.floor(v.value) % 360
      return inherited.rotate
    })()
    if (typeName === 'Pages') {
      const kidsVal = getDictValue(dict, 'Kids')
      const kids = deref(objects, kidsVal)
      if (isArray(kids)) for (const k of kids.items) if (isRef(k)) walkPages(k, { resources, mediaBox, rotate }, depth + 1)
      return
    }
    if (typeName === 'Page' || typeName === '') {
      pages.push({ ref, resources, mediaBox, rotate })
      return
    }
  }
  walkPages(pagesRef, { resources: null, mediaBox: null, rotate: 0 }, 0)

  const includeImages = !!args.includeImages
  const assetUrlPrefix = String(args.assetUrlPrefix || '').trim()
  const shouldExtractImages = includeImages || !!args.ocrEnhance?.enabled
  const maxPages = typeof args.maxPages === 'number' && args.maxPages > 0 ? Math.floor(args.maxPages) : pages.length
  const maxExtractedImagesPerPage = typeof args.maxExtractedImagesPerPage === 'number' && args.maxExtractedImagesPerPage > 0 ? Math.floor(args.maxExtractedImagesPerPage) : 12
  const maxEmbeddedImagesPerPage = typeof args.maxEmbeddedImagesPerPage === 'number' && args.maxEmbeddedImagesPerPage >= 0 ? Math.floor(args.maxEmbeddedImagesPerPage) : 6
  const maxNeededImagesPerPage = Math.min(maxExtractedImagesPerPage, Math.max(0, maxEmbeddedImagesPerPage))
  const usedPages = pages.slice(0, Math.max(0, Math.min(maxPages, pages.length)))

  const docLines: string[] = []
  docLines.push(`# ${String(args.title || '').trim() || 'document.pdf'}`)
  docLines.push('')

  const allAssets: NativePdfAsset[] = []

  for (let i = 0; i < usedPages.length; i += 1) {
    const p = usedPages[i]
    const pageDict = objects.get(p.ref.obj)?.dict || null
    const contentVal = pageDict ? getDictValue(pageDict, 'Contents') : null
    const contentRefs = (() => {
      const v = deref(objects, contentVal)
      if (isRef(contentVal)) return [contentVal]
      if (isRef(v)) return [v]
      if (isArray(v)) return v.items.filter(isRef)
      return []
    })()
    const contentBytes = (() => {
      const parts: Buffer[] = []
      for (const r of contentRefs) {
        const st = readStream(objects, r, streamDecodeCache)
        if (st.bytes) parts.push(st.bytes)
      }
      return parts.length > 0 ? Buffer.concat(parts) : Buffer.alloc(0)
    })()

    const fragments = extractTextFragmentsFromPage({ objects, pageResources: p.resources, contentBytes, maxDepth: 5, streamDecodeCache })

    const pageAssets = shouldExtractImages
      ? extractPageImages({
          objects,
          resources: p.resources,
          contentBytes,
          pageIndex: i,
          limit: args.ocrEnhance?.enabled ? maxExtractedImagesPerPage : maxNeededImagesPerPage,
          streamDecodeCache,
        })
      : []
    if (pageAssets.length > 0) allAssets.push(...pageAssets)

    const ocrMarkdown = await maybeEnhancePageWithOcr({
      pageIndex: i,
      textFragments: fragments,
      imageAssets: pageAssets,
      config: args.ocrEnhance || null,
    })

    docLines.push(
      buildMarkdownForPage({
        pageIndex: i,
        fragments,
        mediaBox: p.mediaBox,
        includeImages,
        imageAssets: pageAssets,
        assetUrlPrefix,
        maxImagesPerPage: maxEmbeddedImagesPerPage,
        ocrMarkdown,
      }),
    )
  }

  return { markdown: docLines.join('\n'), assets: allAssets }
}

export async function writePdfAssets(args: { assetsDir: string; assets: NativePdfAsset[] }): Promise<void> {
  const dir = String(args.assetsDir || '').trim()
  if (!dir) return
  await fs.mkdir(dir, { recursive: true })
  for (const asset of args.assets) {
    const filename = path.basename(String(asset.filename || '').trim())
    if (!filename) continue
    await fs.writeFile(path.join(dir, filename), asset.bytes)
  }
}
