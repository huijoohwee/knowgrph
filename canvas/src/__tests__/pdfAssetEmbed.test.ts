import { embedPdfAssetsInMarkdown } from '@/lib/pdf/embedPdfAssetsInMarkdown'
import type { NativePdfAsset } from '@/lib/pdf/native/types'

export async function testPdfAssetEmbeddingRewritesLinksToDataUris() {
  const assets: NativePdfAsset[] = [
    { filename: 'a.png', bytes: Buffer.from('hello'), contentType: 'image/png' },
    { filename: 'b.jpg', bytes: Buffer.from('world'), contentType: 'image/jpeg' },
  ]
  const prefix = '/__pdf_assets/token'
  const markdown = ['# doc', '', `![A](${prefix}/a.png)`, `![B](${prefix}/b.jpg)`, ''].join('\n')
  const res = embedPdfAssetsInMarkdown({ markdown, assets, assetUrlPrefix: prefix, maxTotalBytes: 1_000_000, maxAssetBytes: 1_000_000 })
  if (!res.markdown.includes('](data:image/png;base64,')) throw new Error('expected png to be embedded')
  if (!res.markdown.includes('](data:image/jpeg;base64,')) throw new Error('expected jpeg to be embedded')
  if (res.embeddedCount !== 2) throw new Error(`expected embeddedCount=2, got ${res.embeddedCount}`)
  if (res.embeddedBytes !== 10) throw new Error(`expected embeddedBytes=10, got ${res.embeddedBytes}`)
}

export async function testPdfAssetEmbeddingRespectsSizeCaps() {
  const assets: NativePdfAsset[] = [
    { filename: 'big.png', bytes: Buffer.alloc(100), contentType: 'image/png' },
    { filename: 'small.png', bytes: Buffer.alloc(10), contentType: 'image/png' },
  ]
  const prefix = '/__pdf_assets/t'
  const markdown = ['# doc', '', `![Big](${prefix}/big.png)`, `![Small](${prefix}/small.png)`, ''].join('\n')
  const res = embedPdfAssetsInMarkdown({ markdown, assets, assetUrlPrefix: prefix, maxTotalBytes: 25, maxAssetBytes: 50 })
  if (!res.markdown.includes(`(${prefix}/big.png)`)) throw new Error('expected big asset link to remain')
  const dataCount = (res.markdown.match(/\(data:image\/png;base64,/g) || []).length
  if (dataCount !== 1) throw new Error(`expected 1 embedded data uri, got ${dataCount}`)
  if (res.embeddedCount !== 1) throw new Error(`expected embeddedCount=1, got ${res.embeddedCount}`)
  if (res.embeddedBytes !== 10) throw new Error(`expected embeddedBytes=10, got ${res.embeddedBytes}`)
}
