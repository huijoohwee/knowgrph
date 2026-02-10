import { buildMarkdownForPage } from '@/lib/pdf/native/pdfMarkdown'
import type { NativePdfAsset, TextFragment } from '@/lib/pdf/native/types'

export async function testPdfMarkdownEmbedsMultipleImagesUpToLimit() {
  const fragments: TextFragment[] = [{ x: 10, y: 10, fontSize: 12, fontKey: 'F1', text: 'hello' }]
  const assets: NativePdfAsset[] = [
    { filename: 'a.jpg', bytes: Buffer.from('a'), contentType: 'image/jpeg' },
    { filename: 'b.jpg', bytes: Buffer.from('bb'), contentType: 'image/jpeg' },
    { filename: 'c.jpg', bytes: Buffer.from('ccc'), contentType: 'image/jpeg' },
    { filename: 'd.jpg', bytes: Buffer.from('dddd'), contentType: 'image/jpeg' },
  ]
  const md = buildMarkdownForPage({
    pageIndex: 0,
    fragments,
    mediaBox: [0, 0, 612, 792],
    includeImages: true,
    imageAssets: assets,
    assetUrlPrefix: '/__pdf_assets/t',
    maxImagesPerPage: 3,
  })
  if (!md.includes('### Images')) throw new Error('expected Images section')
  const count = (md.match(/!\[Page 1 Image/g) || []).length
  if (count !== 3) throw new Error(`expected 3 embedded images, got ${count}`)
  if (md.includes('/d.jpg')) throw new Error('expected embed limit to exclude extra images')
}

export async function testPdfMarkdownEmbedsSingleImageWithoutGalleryHeader() {
  const fragments: TextFragment[] = [{ x: 10, y: 10, fontSize: 12, fontKey: 'F1', text: 'hello' }]
  const assets: NativePdfAsset[] = [{ filename: 'only.jpg', bytes: Buffer.from('x'), contentType: 'image/jpeg' }]
  const md = buildMarkdownForPage({
    pageIndex: 1,
    fragments,
    mediaBox: [0, 0, 612, 792],
    includeImages: true,
    imageAssets: assets,
    assetUrlPrefix: '/__pdf_assets/t',
    maxImagesPerPage: 6,
  })
  if (md.includes('### Images')) throw new Error('expected no Images header for single image')
  if (!md.includes('![Page 2](/__pdf_assets/t/only.jpg)')) throw new Error('expected single image embed')
}

