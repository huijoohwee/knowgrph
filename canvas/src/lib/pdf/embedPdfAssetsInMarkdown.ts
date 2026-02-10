import type { NativePdfAsset } from './native/types'

export type EmbedPdfAssetsResult = {
  markdown: string
  embeddedCount: number
  embeddedBytes: number
}

export function embedPdfAssetsInMarkdown(args: {
  markdown: string
  assets: NativePdfAsset[]
  assetUrlPrefix: string
  maxTotalBytes?: number
  maxAssetBytes?: number
}): EmbedPdfAssetsResult {
  const prefix = String(args.assetUrlPrefix || '').trim()
  if (!prefix) return { markdown: String(args.markdown || ''), embeddedCount: 0, embeddedBytes: 0 }

  const maxTotalBytes = (() => {
    const n = args.maxTotalBytes
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 4 * 1024 * 1024
    return Math.min(50 * 1024 * 1024, Math.floor(n))
  })()
  const maxAssetBytes = (() => {
    const n = args.maxAssetBytes
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 2 * 1024 * 1024
    return Math.min(20 * 1024 * 1024, Math.floor(n))
  })()

  let markdown = String(args.markdown || '')
  let embeddedCount = 0
  let embeddedBytes = 0

  for (const asset of args.assets || []) {
    const filename = String(asset?.filename || '').trim()
    if (!filename) continue
    const bytes = asset?.bytes
    if (!bytes || bytes.length <= 0) continue
    if (bytes.length > maxAssetBytes) continue
    if (embeddedBytes + bytes.length > maxTotalBytes) continue

    const contentType = String(asset?.contentType || '').trim() || 'application/octet-stream'
    const dataUrl = `data:${contentType};base64,${bytes.toString('base64')}`
    const from = `(${prefix}/${filename})`
    if (!markdown.includes(from)) continue
    markdown = markdown.split(from).join(`(${dataUrl})`)
    embeddedCount += 1
    embeddedBytes += bytes.length
  }

  return { markdown, embeddedCount, embeddedBytes }
}
