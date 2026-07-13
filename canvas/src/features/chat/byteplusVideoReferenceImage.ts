import { resolveBinaryDownloadProxyUrl } from '@/lib/chatEndpoint'

const BYTEPLUS_BASE64_IMAGE_LIMIT_BYTES = 10 * 1024 * 1024

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export async function resolveBytePlusVideoReferenceImage(args: {
  mode: unknown
  url: unknown
}): Promise<string> {
  const url = typeof args.url === 'string' ? args.url.trim() : ''
  if (!url || String(args.mode || '').trim().toLowerCase() === 'url' || url.startsWith('data:')) return url
  const downloadUrl = resolveBinaryDownloadProxyUrl(url)
  if (!downloadUrl) throw new Error('BytePlus video run failed: generated reference image URL cannot be read through the shared asset proxy.')
  const response = await fetch(downloadUrl, { headers: { Accept: 'image/*' } })
  if (!response.ok) throw new Error(`BytePlus video run failed: generated reference image read-back failed (${response.status}).`)
  const blob = await response.blob()
  if (blob.size > BYTEPLUS_BASE64_IMAGE_LIMIT_BYTES) {
    throw new Error('BytePlus video run failed: generated reference image exceeds the 10 MB Base64 input limit.')
  }
  const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/png'
  return `data:${mimeType};base64,${encodeBase64(new Uint8Array(await blob.arrayBuffer()))}`
}
