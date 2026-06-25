export type TimelineMediaContainerRead = {
  byteSize: number
  bytesRead: number
  mimeType: string
  view: DataView | null
}

export type TimelineMediaContainerMetadata = {
  audioTrackCount: number
  audioChannelCount: number
  audioSampleRate: number
  averageVideoBitrate: number
  averageVideoFrameRate: number
  byteSize: number
  bytesRead: number
  compatibleBrands: string[]
  containerBrand: string
  displayHeight: number
  displayWidth: number
  durationSeconds: number
  formatName: string
  metadataReadRatio: number
  mimeType: string
  primaryAudioCodec: string
  primaryVideoCodec: string
  timeResolution: number
  videoTrackCount: number
}

type IsoBox = {
  contentStart: number
  end: number
  start: number
  type: string
}

type IsoTrackSummary = {
  audioChannelCount: number
  audioSampleRate: number
  codec: string
  durationSeconds: number
  height: number
  kind: 'audio' | 'video' | 'unknown'
  sampleCount: number
  sampleDurationUnits: number
  timeResolution: number
  width: number
}

const NATIVE_MEDIA_CONTAINER_READ_BYTES = 8 * 2 ** 20
const NATIVE_MEDIA_CONTAINER_READ_TIMEOUT_MS = 2500

const EMPTY_NATIVE_MEDIA_CONTAINER_METADATA: TimelineMediaContainerMetadata = {
  audioTrackCount: 0,
  audioChannelCount: 0,
  audioSampleRate: 0,
  averageVideoBitrate: 0,
  averageVideoFrameRate: 0,
  byteSize: 0,
  bytesRead: 0,
  compatibleBrands: [],
  containerBrand: '',
  displayHeight: 0,
  displayWidth: 0,
  durationSeconds: 0,
  formatName: '',
  metadataReadRatio: 0,
  mimeType: '',
  primaryAudioCodec: '',
  primaryVideoCodec: '',
  timeResolution: 0,
  videoTrackCount: 0,
}

const clean = (value: unknown): string => String(value || '').trim()

const readPositiveNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const readAscii = (view: DataView, offset: number, length: number): string => {
  if (offset < 0 || length <= 0 || offset + length > view.byteLength) return ''
  let out = ''
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(view.getUint8(offset + index))
  return out
}

const readUint64AsNumber = (view: DataView, offset: number): number => {
  if (offset + 8 > view.byteLength) return 0
  const high = view.getUint32(offset)
  const low = view.getUint32(offset + 4)
  const value = high * 2 ** 32 + low
  return Number.isSafeInteger(value) ? value : 0
}

const readFixed16_16 = (value: number): number => value > 0 ? value / 65536 : 0

const resolveByteSize = (response: Response, bytesRead: number): number => {
  const rangeTotal = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get('content-range') || '')?.[1]
  const contentLength = response.headers.get('content-length') || ''
  return readPositiveNumber(rangeTotal) || readPositiveNumber(contentLength) || bytesRead
}

const resolveIsoFormatName = (brand: string): string => {
  const lower = brand.toLowerCase()
  if (!lower) return ''
  if (lower.startsWith('qt')) return 'quicktime'
  return 'iso-bmff'
}

const readIsoBox = (view: DataView, offset: number, end: number): IsoBox | null => {
  if (offset + 8 > end || offset + 8 > view.byteLength) return null
  const size32 = view.getUint32(offset)
  const type = readAscii(view, offset + 4, 4)
  if (!type.trim()) return null
  let headerSize = 8
  let size = size32
  if (size32 === 1) {
    if (offset + 16 > end) return null
    headerSize = 16
    size = readUint64AsNumber(view, offset + 8)
  } else if (size32 === 0) {
    size = end - offset
  }
  if (size < headerSize) return null
  const boxEnd = Math.min(offset + size, end, view.byteLength)
  if (boxEnd < offset + headerSize) return null
  return { contentStart: offset + headerSize, end: boxEnd, start: offset, type }
}

const findIsoChildBox = (view: DataView, start: number, end: number, type: string): IsoBox | null => {
  let offset = start
  while (offset + 8 <= end) {
    const box = readIsoBox(view, offset, end)
    if (!box) break
    if (box.type === type) return box
    offset = box.end
  }
  return null
}

const readIsoChildren = (view: DataView, start: number, end: number): IsoBox[] => {
  const boxes: IsoBox[] = []
  let offset = start
  while (offset + 8 <= end) {
    const box = readIsoBox(view, offset, end)
    if (!box) break
    boxes.push(box)
    offset = box.end
  }
  return boxes
}

const readIsoFtyp = (view: DataView): Pick<TimelineMediaContainerMetadata, 'compatibleBrands' | 'containerBrand' | 'formatName'> => {
  const ftyp = findIsoChildBox(view, 0, view.byteLength, 'ftyp')
  if (!ftyp || ftyp.contentStart + 8 > ftyp.end) return { compatibleBrands: [], containerBrand: '', formatName: '' }
  const containerBrand = clean(readAscii(view, ftyp.contentStart, 4))
  const compatibleBrands: string[] = []
  for (let offset = ftyp.contentStart + 8; offset + 4 <= ftyp.end; offset += 4) {
    const brand = clean(readAscii(view, offset, 4))
    if (brand) compatibleBrands.push(brand)
  }
  return { compatibleBrands, containerBrand, formatName: resolveIsoFormatName(containerBrand) }
}

const readIsoMdhd = (view: DataView, box: IsoBox | null): Pick<IsoTrackSummary, 'durationSeconds' | 'timeResolution'> => {
  if (!box || box.contentStart + 24 > box.end) return { durationSeconds: 0, timeResolution: 0 }
  const version = view.getUint8(box.contentStart)
  const timescaleOffset = version === 1 ? box.contentStart + 20 : box.contentStart + 12
  const durationOffset = version === 1 ? box.contentStart + 24 : box.contentStart + 16
  if (timescaleOffset + 4 > box.end) return { durationSeconds: 0, timeResolution: 0 }
  const timeResolution = readPositiveNumber(view.getUint32(timescaleOffset))
  const durationUnits = version === 1 ? readUint64AsNumber(view, durationOffset) : (durationOffset + 4 <= box.end ? view.getUint32(durationOffset) : 0)
  return { durationSeconds: timeResolution > 0 ? readPositiveNumber(durationUnits / timeResolution) : 0, timeResolution }
}

const readIsoHandlerKind = (view: DataView, box: IsoBox | null): IsoTrackSummary['kind'] => {
  if (!box || box.contentStart + 12 > box.end) return 'unknown'
  const handlerType = readAscii(view, box.contentStart + 8, 4)
  if (handlerType === 'vide') return 'video'
  if (handlerType === 'soun') return 'audio'
  return 'unknown'
}

const readIsoStts = (view: DataView, box: IsoBox | null): Pick<IsoTrackSummary, 'sampleCount' | 'sampleDurationUnits'> => {
  if (!box || box.contentStart + 8 > box.end) return { sampleCount: 0, sampleDurationUnits: 0 }
  const entryCount = view.getUint32(box.contentStart + 4)
  let sampleCount = 0
  let sampleDurationUnits = 0
  let offset = box.contentStart + 8
  for (let index = 0; index < entryCount && offset + 8 <= box.end; index += 1) {
    const count = view.getUint32(offset)
    const delta = view.getUint32(offset + 4)
    sampleCount += count
    sampleDurationUnits += count * delta
    offset += 8
  }
  return { sampleCount, sampleDurationUnits }
}

const readIsoStsd = (view: DataView, box: IsoBox | null, kind: IsoTrackSummary['kind']): Pick<IsoTrackSummary, 'audioChannelCount' | 'audioSampleRate' | 'codec' | 'height' | 'width'> => {
  if (!box || box.contentStart + 16 > box.end) return { audioChannelCount: 0, audioSampleRate: 0, codec: '', height: 0, width: 0 }
  const entryStart = box.contentStart + 8
  const codec = clean(readAscii(view, entryStart + 4, 4))
  if (kind === 'video') return { audioChannelCount: 0, audioSampleRate: 0, codec, height: entryStart + 36 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 34)) : 0, width: entryStart + 34 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 32)) : 0 }
  if (kind === 'audio') return { audioChannelCount: entryStart + 26 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 24)) : 0, audioSampleRate: entryStart + 36 <= box.end ? readPositiveNumber(readFixed16_16(view.getUint32(entryStart + 32))) : 0, codec, height: 0, width: 0 }
  return { audioChannelCount: 0, audioSampleRate: 0, codec, height: 0, width: 0 }
}

const readIsoTrackSummary = (view: DataView, trak: IsoBox): IsoTrackSummary => {
  const mdia = findIsoChildBox(view, trak.contentStart, trak.end, 'mdia')
  const minf = mdia ? findIsoChildBox(view, mdia.contentStart, mdia.end, 'minf') : null
  const stbl = minf ? findIsoChildBox(view, minf.contentStart, minf.end, 'stbl') : null
  const kind = readIsoHandlerKind(view, mdia ? findIsoChildBox(view, mdia.contentStart, mdia.end, 'hdlr') : null)
  const timing = readIsoMdhd(view, mdia ? findIsoChildBox(view, mdia.contentStart, mdia.end, 'mdhd') : null)
  const sampleTiming = readIsoStts(view, stbl ? findIsoChildBox(view, stbl.contentStart, stbl.end, 'stts') : null)
  const sampleDescription = readIsoStsd(view, stbl ? findIsoChildBox(view, stbl.contentStart, stbl.end, 'stsd') : null, kind)
  return { ...timing, ...sampleTiming, ...sampleDescription, kind }
}

export async function fetchNativeMediaContainerBytes(url: string): Promise<TimelineMediaContainerRead> {
  if (typeof fetch === 'undefined' || typeof AbortController === 'undefined' || typeof window === 'undefined') {
    return { byteSize: 0, bytesRead: 0, mimeType: '', view: null }
  }
  const abortController = new AbortController()
  const timeoutId = window.setTimeout(() => abortController.abort(), NATIVE_MEDIA_CONTAINER_READ_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${NATIVE_MEDIA_CONTAINER_READ_BYTES - 1}` },
      signal: abortController.signal,
    })
    if (!response.ok) return { byteSize: 0, bytesRead: 0, mimeType: '', view: null }
    const buffer = await response.arrayBuffer()
    const bytesRead = buffer.byteLength
    return {
      byteSize: resolveByteSize(response, bytesRead),
      bytesRead,
      mimeType: clean(response.headers.get('content-type') || '').toLowerCase(),
      view: bytesRead ? new DataView(buffer) : null,
    }
  } catch {
    return { byteSize: 0, bytesRead: 0, mimeType: '', view: null }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function readNativeIsoBmffContainerSummary(read: TimelineMediaContainerRead | null): TimelineMediaContainerMetadata {
  const view = read?.view || null
  const byteSize = readPositiveNumber(read?.byteSize)
  const bytesRead = readPositiveNumber(read?.bytesRead)
  const metadataReadRatio = byteSize > 0 ? Math.min(1, bytesRead / byteSize) : (bytesRead > 0 ? 1 : 0)
  if (!view) return { ...EMPTY_NATIVE_MEDIA_CONTAINER_METADATA, byteSize, bytesRead, metadataReadRatio, mimeType: clean(read?.mimeType || '') }
  const containerIdentity = readIsoFtyp(view)
  const moov = findIsoChildBox(view, 0, view.byteLength, 'moov')
  if (!moov) return { ...EMPTY_NATIVE_MEDIA_CONTAINER_METADATA, ...containerIdentity, byteSize, bytesRead, metadataReadRatio, mimeType: clean(read?.mimeType || '') }
  const tracks = readIsoChildren(view, moov.contentStart, moov.end).filter(box => box.type === 'trak').map(track => readIsoTrackSummary(view, track))
  const videoTracks = tracks.filter(track => track.kind === 'video')
  const audioTracks = tracks.filter(track => track.kind === 'audio')
  const primaryVideoTrack = videoTracks[0]
  const primaryAudioTrack = audioTracks[0]
  const durationSeconds = Math.max(0, ...tracks.map(track => track.durationSeconds))
  const averageVideoFrameRate = primaryVideoTrack?.sampleDurationUnits && primaryVideoTrack.timeResolution > 0
    ? readPositiveNumber(primaryVideoTrack.sampleCount / (primaryVideoTrack.sampleDurationUnits / primaryVideoTrack.timeResolution))
    : 0
  return {
    ...containerIdentity,
    audioTrackCount: audioTracks.length,
    audioChannelCount: primaryAudioTrack?.audioChannelCount || 0,
    audioSampleRate: primaryAudioTrack?.audioSampleRate || 0,
    averageVideoBitrate: byteSize > 0 && durationSeconds > 0 ? Math.round((byteSize * 8) / durationSeconds) : 0,
    averageVideoFrameRate,
    byteSize,
    bytesRead,
    displayHeight: primaryVideoTrack?.height || 0,
    displayWidth: primaryVideoTrack?.width || 0,
    durationSeconds,
    metadataReadRatio,
    mimeType: clean(read?.mimeType || '') || (containerIdentity.formatName ? 'video/mp4' : ''),
    primaryAudioCodec: primaryAudioTrack?.codec || '',
    primaryVideoCodec: primaryVideoTrack?.codec || '',
    timeResolution: Math.max(0, ...tracks.map(track => track.timeResolution)),
    videoTrackCount: videoTracks.length,
  }
}
