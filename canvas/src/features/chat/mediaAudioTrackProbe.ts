type IsoBmffBox = {
  type: string
  payloadStart: number
  end: number
}

export const MEDIA_AUDIO_PROBE_SLICE_BYTES = 2 * 1024 * 1024

const readAscii = (bytes: Uint8Array, offset: number, length: number): string => {
  if (offset < 0 || offset + length > bytes.length) return ''
  let value = ''
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(bytes[offset + index] || 0)
  return value
}

const readBox = (bytes: Uint8Array, offset: number, parentEnd: number): IsoBmffBox | null => {
  if (offset + 8 > parentEnd || offset + 8 > bytes.length) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const size32 = view.getUint32(offset)
  const type = readAscii(bytes, offset + 4, 4)
  let headerSize = 8
  let boxSize = size32
  if (size32 === 1) {
    if (offset + 16 > parentEnd) return null
    headerSize = 16
    boxSize = view.getUint32(offset + 8) * 2 ** 32 + view.getUint32(offset + 12)
  } else if (size32 === 0) {
    boxSize = parentEnd - offset
  }
  if (!Number.isSafeInteger(boxSize) || boxSize < headerSize) return null
  const end = offset + boxSize
  if (end > parentEnd || end > bytes.length) return null
  return { type, payloadStart: offset + headerSize, end }
}

const readChildren = (bytes: Uint8Array, start: number, end: number): IsoBmffBox[] => {
  const boxes: IsoBmffBox[] = []
  let offset = start
  while (offset < end) {
    const box = readBox(bytes, offset, end)
    if (!box) break
    boxes.push(box)
    offset = box.end
  }
  return boxes
}

export function hasIsoBmffAudioTrackBytes(bytes: Uint8Array): boolean {
  const movieBoxes = readChildren(bytes, 0, bytes.length).filter(box => box.type === 'moov')
  for (const movieBox of movieBoxes) {
    const trackBoxes = readChildren(bytes, movieBox.payloadStart, movieBox.end).filter(box => box.type === 'trak')
    for (const trackBox of trackBoxes) {
      const mediaBoxes = readChildren(bytes, trackBox.payloadStart, trackBox.end).filter(box => box.type === 'mdia')
      for (const mediaBox of mediaBoxes) {
        const handlerBoxes = readChildren(bytes, mediaBox.payloadStart, mediaBox.end).filter(box => box.type === 'hdlr')
        if (handlerBoxes.some(box => readAscii(bytes, box.payloadStart + 8, 4) === 'soun')) return true
      }
    }
  }
  return false
}

const hasIsoBmffAudioHandlerSignature = (bytes: Uint8Array): boolean => {
  if (bytes.length < 20) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let typeOffset = 4; typeOffset + 16 <= bytes.length; typeOffset += 1) {
    if (readAscii(bytes, typeOffset, 4) !== 'hdlr' || readAscii(bytes, typeOffset + 12, 4) !== 'soun') continue
    const boxStart = typeOffset - 4
    const boxSize = view.getUint32(boxStart)
    if (boxSize >= 20 && boxStart + boxSize <= bytes.length) return true
  }
  return false
}

const probeSlice = async (blob: Blob, start: number, end: number): Promise<boolean> => {
  const bytes = new Uint8Array(await blob.slice(start, end).arrayBuffer())
  return hasIsoBmffAudioTrackBytes(bytes) || hasIsoBmffAudioHandlerSignature(bytes)
}

export async function hasMediaAudioTrack(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 8) return false
  try {
    const headEnd = Math.min(blob.size, MEDIA_AUDIO_PROBE_SLICE_BYTES)
    if (await probeSlice(blob, 0, headEnd)) return true
    if (headEnd >= blob.size) return false
    const tailStart = Math.max(0, blob.size - MEDIA_AUDIO_PROBE_SLICE_BYTES)
    return await probeSlice(blob, tailStart, blob.size)
  } catch {
    return false
  }
}
