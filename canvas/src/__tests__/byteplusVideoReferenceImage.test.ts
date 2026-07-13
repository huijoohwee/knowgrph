import { resolveBytePlusVideoReferenceImage } from '@/features/chat/byteplusVideoReferenceImage'

export async function testBytePlusVideoReferenceImageMaterializesBase64Mode() {
  const originalFetch = globalThis.fetch
  try {
    let requestedUrl = ''
    globalThis.fetch = (async input => {
      requestedUrl = String(input)
      return new Response(new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }), { status: 200 })
    }) as typeof fetch
    const result = await resolveBytePlusVideoReferenceImage({ mode: 'base64', url: 'https://example.com/keyframe.png' })
    if (!requestedUrl.startsWith('/__chat_asset_proxy?url=')) {
      throw new Error(`expected reference image read-back through shared asset proxy, got ${requestedUrl}`)
    }
    if (result !== 'data:image/png;base64,AQID') {
      throw new Error(`expected ModelArk Base64 data URL, got ${result}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testBytePlusVideoReferenceImagePreservesUrlMode() {
  const url = 'https://example.com/keyframe.png'
  if (await resolveBytePlusVideoReferenceImage({ mode: 'url', url }) !== url) {
    throw new Error('expected explicit URL mode to preserve the provider-accessible URL')
  }
}
