import React from 'react'
import type { PreferredMediaImageFormat } from '@/lib/media/mediaFormatPreference'

export type TimelineMediaReaderStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error'

export type TimelineMediaReaderSummary = {
  audioTrackCount: number
  audioChannelCount: number
  audioSampleRate: number
  averageVideoBitrate: number
  averageVideoFrameRate: number
  canDecodeAudio: boolean | null
  canDecodeVideo: boolean | null
  displayHeight: number
  displayWidth: number
  durationSeconds: number
  durationSource: 'computed' | 'metadata' | ''
  primaryAudioCodec: string
  primaryVideoCodec: string
  status: TimelineMediaReaderStatus
  thumbnailHeight: number
  thumbnails: TimelineMediaReaderThumbnail[]
  thumbnailWidth: number
  timeResolution: number
  videoTrackCount: number
}

export type TimelineMediaReaderThumbnail = {
  dataUrl: string
  format: PreferredMediaImageFormat
  height: number
  mimeType: string
  rasterDataUrl: string
  rasterFormat: Exclude<PreferredMediaImageFormat, 'svg'>
  rasterMimeType: string
  timestampSeconds: number
  width: number
}

type NativeMediaElementSummary = {
  durationSeconds: number
  displayHeight: number
  displayWidth: number
  canPlayMp4: boolean | null
}

type NativeMediaContainerSummary = {
  audioTrackCount: number
  audioChannelCount: number
  audioSampleRate: number
  averageVideoBitrate: number
  averageVideoFrameRate: number
  displayHeight: number
  displayWidth: number
  durationSeconds: number
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

const EMPTY_TIMELINE_MEDIA_READER_SUMMARY: TimelineMediaReaderSummary = {
  audioTrackCount: 0,
  audioChannelCount: 0,
  audioSampleRate: 0,
  averageVideoBitrate: 0,
  averageVideoFrameRate: 0,
  canDecodeAudio: null,
  canDecodeVideo: null,
  displayHeight: 0,
  displayWidth: 0,
  durationSeconds: 0,
  durationSource: '',
  primaryAudioCodec: '',
  primaryVideoCodec: '',
  status: 'idle',
  thumbnailHeight: 0,
  thumbnails: [],
  thumbnailWidth: 0,
  timeResolution: 0,
  videoTrackCount: 0,
}

const TIMELINE_MEDIA_READER_CACHE = new Map<string, Promise<TimelineMediaReaderSummary>>()
const NATIVE_MEDIA_CONTAINER_READ_BYTES = 8 * 2 ** 20
const NATIVE_MEDIA_CONTAINER_READ_TIMEOUT_MS = 2500
const NATIVE_MEDIA_METADATA_TIMEOUT_MS = 3000
const NATIVE_MEDIA_THUMBNAIL_COUNT = 5
const NATIVE_MEDIA_THUMBNAIL_HEIGHT = 72
const NATIVE_MEDIA_THUMBNAIL_MAX_WIDTH = 128
const NATIVE_MEDIA_THUMBNAIL_TIMEOUT_MS = 4500

const clean = (value: unknown): string => String(value || '').trim()

const readPositiveNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const escapeXml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const toSvgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

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
  if (boxEnd <= offset + headerSize) return null
  return {
    contentStart: offset + headerSize,
    end: boxEnd,
    start: offset,
    type,
  }
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

const readIsoMdhd = (view: DataView, box: IsoBox | null): Pick<IsoTrackSummary, 'durationSeconds' | 'timeResolution'> => {
  if (!box || box.contentStart + 24 > box.end) return { durationSeconds: 0, timeResolution: 0 }
  const version = view.getUint8(box.contentStart)
  const timescaleOffset = version === 1 ? box.contentStart + 20 : box.contentStart + 12
  const durationOffset = version === 1 ? box.contentStart + 24 : box.contentStart + 16
  if (timescaleOffset + 4 > box.end) return { durationSeconds: 0, timeResolution: 0 }
  const timeResolution = readPositiveNumber(view.getUint32(timescaleOffset))
  const durationUnits = version === 1 ? readUint64AsNumber(view, durationOffset) : (durationOffset + 4 <= box.end ? view.getUint32(durationOffset) : 0)
  return {
    durationSeconds: timeResolution > 0 ? readPositiveNumber(durationUnits / timeResolution) : 0,
    timeResolution,
  }
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
  if (!box || box.contentStart + 16 > box.end) {
    return { audioChannelCount: 0, audioSampleRate: 0, codec: '', height: 0, width: 0 }
  }
  const entryStart = box.contentStart + 8
  const codec = clean(readAscii(view, entryStart + 4, 4))
  if (kind === 'video') {
    return {
      audioChannelCount: 0,
      audioSampleRate: 0,
      codec,
      height: entryStart + 36 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 34)) : 0,
      width: entryStart + 34 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 32)) : 0,
    }
  }
  if (kind === 'audio') {
    return {
      audioChannelCount: entryStart + 26 <= box.end ? readPositiveNumber(view.getUint16(entryStart + 24)) : 0,
      audioSampleRate: entryStart + 36 <= box.end ? readPositiveNumber(readFixed16_16(view.getUint32(entryStart + 32))) : 0,
      codec,
      height: 0,
      width: 0,
    }
  }
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
  return {
    ...timing,
    ...sampleTiming,
    ...sampleDescription,
    kind,
  }
}

async function fetchNativeMediaContainerBytes(url: string): Promise<DataView | null> {
  if (typeof fetch === 'undefined' || typeof AbortController === 'undefined') return null
  const abortController = new AbortController()
  const timeoutId = window.setTimeout(() => abortController.abort(), NATIVE_MEDIA_CONTAINER_READ_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${NATIVE_MEDIA_CONTAINER_READ_BYTES - 1}` },
      signal: abortController.signal,
    })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    if (!buffer.byteLength) return null
    return new DataView(buffer)
  } catch {
    return null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function readNativeIsoBmffContainerSummary(view: DataView | null): NativeMediaContainerSummary {
  if (!view) {
    return {
      audioTrackCount: 0,
      audioChannelCount: 0,
      audioSampleRate: 0,
      averageVideoBitrate: 0,
      averageVideoFrameRate: 0,
      displayHeight: 0,
      displayWidth: 0,
      durationSeconds: 0,
      primaryAudioCodec: '',
      primaryVideoCodec: '',
      timeResolution: 0,
      videoTrackCount: 0,
    }
  }
  const moov = findIsoChildBox(view, 0, view.byteLength, 'moov')
  if (!moov) return readNativeIsoBmffContainerSummary(null)
  const tracks = readIsoChildren(view, moov.contentStart, moov.end)
    .filter(box => box.type === 'trak')
    .map(track => readIsoTrackSummary(view, track))
  const videoTracks = tracks.filter(track => track.kind === 'video')
  const audioTracks = tracks.filter(track => track.kind === 'audio')
  const primaryVideoTrack = videoTracks[0]
  const primaryAudioTrack = audioTracks[0]
  const durationSeconds = Math.max(0, ...tracks.map(track => track.durationSeconds))
  const timeResolution = Math.max(0, ...tracks.map(track => track.timeResolution))
  const averageVideoFrameRate = primaryVideoTrack?.sampleDurationUnits && primaryVideoTrack.timeResolution > 0
    ? readPositiveNumber(primaryVideoTrack.sampleCount / (primaryVideoTrack.sampleDurationUnits / primaryVideoTrack.timeResolution))
    : 0
  return {
    audioTrackCount: audioTracks.length,
    audioChannelCount: primaryAudioTrack?.audioChannelCount || 0,
    audioSampleRate: primaryAudioTrack?.audioSampleRate || 0,
    averageVideoBitrate: 0,
    averageVideoFrameRate,
    displayHeight: primaryVideoTrack?.height || 0,
    displayWidth: primaryVideoTrack?.width || 0,
    durationSeconds,
    primaryAudioCodec: primaryAudioTrack?.codec || '',
    primaryVideoCodec: primaryVideoTrack?.codec || '',
    timeResolution,
    videoTrackCount: videoTracks.length,
  }
}

function loadNativeMediaElementMetadata(url: string): Promise<NativeMediaElementSummary> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeAttribute('src')
      video.load()
    }
    const finish = (summary: NativeMediaElementSummary) => {
      cleanup()
      resolve(summary)
    }
    const timeoutId = window.setTimeout(() => {
      finish({ canPlayMp4: null, displayHeight: 0, displayWidth: 0, durationSeconds: 0 })
    }, NATIVE_MEDIA_METADATA_TIMEOUT_MS)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      finish({
        canPlayMp4: !!video.canPlayType('video/mp4'),
        displayHeight: readPositiveNumber(video.videoHeight),
        displayWidth: readPositiveNumber(video.videoWidth),
        durationSeconds: readPositiveNumber(video.duration),
      })
    }
    video.onerror = () => {
      finish({ canPlayMp4: !!video.canPlayType('video/mp4'), displayHeight: 0, displayWidth: 0, durationSeconds: 0 })
    }
    video.src = url
    video.load()
  })
}

const waitForMediaEvent = (media: HTMLMediaElement, eventName: keyof HTMLMediaElementEventMap, timeoutMs: number): Promise<boolean> => new Promise(resolve => {
  const cleanup = () => {
    window.clearTimeout(timeoutId)
    media.removeEventListener(eventName, handleEvent)
    media.removeEventListener('error', handleError)
  }
  const finish = (ok: boolean) => {
    cleanup()
    resolve(ok)
  }
  const handleEvent = () => finish(true)
  const handleError = () => finish(false)
  const timeoutId = window.setTimeout(() => finish(false), timeoutMs)
  media.addEventListener(eventName, handleEvent, { once: true })
  media.addEventListener('error', handleError, { once: true })
})

const resolveThumbnailTimestamps = (durationSeconds: number, count: number): number[] => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || count <= 0) return []
  const safeEnd = Math.max(0, durationSeconds - 0.05)
  if (count === 1) return [Math.min(safeEnd, Math.max(0, durationSeconds * 0.5))]
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 0.5) / count
    return Math.min(safeEnd, Math.max(0, durationSeconds * ratio))
  })
}

const readCanvasRasterThumbnail = (canvas: HTMLCanvasElement): {
  dataUrl: string
  format: Exclude<PreferredMediaImageFormat, 'svg'>
  mimeType: string
} => {
  const webp = canvas.toDataURL('image/webp', 0.78)
  if (webp.startsWith('data:image/webp')) {
    return { dataUrl: webp, format: 'webp', mimeType: 'image/webp' }
  }
  const png = canvas.toDataURL('image/png')
  if (png.startsWith('data:image/png')) {
    return { dataUrl: png, format: 'png', mimeType: 'image/png' }
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.76),
    format: 'jpeg',
    mimeType: 'image/jpeg',
  }
}

const buildSemanticThumbnailSvgDataUrl = (args: {
  height: number
  label: string
  rasterDataUrl: string
  rasterFormat: Exclude<PreferredMediaImageFormat, 'svg'>
  timestampSeconds: number
  width: number
}): string => {
  const title = `${args.label} thumbnail ${args.timestampSeconds.toFixed(2)}s`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${args.width}" height="${args.height}" viewBox="0 0 ${args.width} ${args.height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><desc>Native in-repo timeline thumbnail generated from a video frame; embedded raster format ${escapeXml(args.rasterFormat)}.</desc><metadata>{"kind":"video-thumbnail","format":"svg","rasterFormat":"${args.rasterFormat}","timestampSeconds":${Number(args.timestampSeconds.toFixed(6))}}</metadata><image href="${args.rasterDataUrl}" width="${args.width}" height="${args.height}" preserveAspectRatio="xMidYMid slice"/></svg>`
  return toSvgDataUrl(svg)
}

async function loadNativeVideoThumbnails(args: {
  displayHeight: number
  displayWidth: number
  durationSeconds: number
  url: string
}): Promise<TimelineMediaReaderThumbnail[]> {
  if (
    !args.url
    || !Number.isFinite(args.durationSeconds)
    || args.durationSeconds <= 0
    || typeof document === 'undefined'
    || typeof HTMLCanvasElement === 'undefined'
  ) return []
  const sourceWidth = readPositiveNumber(args.displayWidth) || 16
  const sourceHeight = readPositiveNumber(args.displayHeight) || 9
  const thumbnailHeight = NATIVE_MEDIA_THUMBNAIL_HEIGHT
  const thumbnailWidth = Math.max(1, Math.min(NATIVE_MEDIA_THUMBNAIL_MAX_WIDTH, Math.round((sourceWidth / sourceHeight) * thumbnailHeight)))
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  canvas.width = thumbnailWidth
  canvas.height = thumbnailHeight
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return []
  try {
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    const metadataReadyPromise = waitForMediaEvent(video, 'loadedmetadata', NATIVE_MEDIA_METADATA_TIMEOUT_MS)
    video.src = args.url
    video.load()
    const metadataReady = await metadataReadyPromise
    if (!metadataReady) return []
    const thumbnails: TimelineMediaReaderThumbnail[] = []
    for (const timestampSeconds of resolveThumbnailTimestamps(args.durationSeconds, NATIVE_MEDIA_THUMBNAIL_COUNT)) {
      const seekReadyPromise = waitForMediaEvent(video, 'seeked', NATIVE_MEDIA_THUMBNAIL_TIMEOUT_MS)
      video.currentTime = timestampSeconds
      const seekReady = await seekReadyPromise
      if (!seekReady) continue
      try {
        context.drawImage(video, 0, 0, thumbnailWidth, thumbnailHeight)
        const rasterThumbnail = readCanvasRasterThumbnail(canvas)
        thumbnails.push({
          dataUrl: buildSemanticThumbnailSvgDataUrl({
            height: thumbnailHeight,
            label: 'Video',
            rasterDataUrl: rasterThumbnail.dataUrl,
            rasterFormat: rasterThumbnail.format,
            timestampSeconds,
            width: thumbnailWidth,
          }),
          format: 'svg',
          height: thumbnailHeight,
          mimeType: 'image/svg+xml',
          rasterDataUrl: rasterThumbnail.dataUrl,
          rasterFormat: rasterThumbnail.format,
          rasterMimeType: rasterThumbnail.mimeType,
          timestampSeconds,
          width: thumbnailWidth,
        })
      } catch {
        return thumbnails
      }
    }
    return thumbnails
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

const canDecodeCodec = (codec: string, kind: 'audio' | 'video'): boolean | null => {
  if (!codec || typeof document === 'undefined') return null
  const probe = document.createElement(kind === 'audio' ? 'audio' : 'video')
  const container = kind === 'audio' ? 'audio/mp4' : 'video/mp4'
  const result = probe.canPlayType(`${container}; codecs="${codec}"`) || probe.canPlayType(container)
  return result ? true : false
}

async function loadTimelineMediaReaderSummaryUncached(url: string): Promise<TimelineMediaReaderSummary> {
  if (!url || typeof window === 'undefined' || typeof document === 'undefined') return EMPTY_TIMELINE_MEDIA_READER_SUMMARY
  const [mediaElement, container] = await Promise.all([
    loadNativeMediaElementMetadata(url),
    fetchNativeMediaContainerBytes(url).then(readNativeIsoBmffContainerSummary),
  ])
  const durationSeconds = container.durationSeconds || mediaElement.durationSeconds
  const displayWidth = container.displayWidth || mediaElement.displayWidth
  const displayHeight = container.displayHeight || mediaElement.displayHeight
  const videoTrackCount = container.videoTrackCount || (displayWidth > 0 || displayHeight > 0 ? 1 : 0)
  const thumbnails = videoTrackCount > 0
    ? await loadNativeVideoThumbnails({
      displayHeight,
      displayWidth,
      durationSeconds,
      url,
    })
    : []
  const status: TimelineMediaReaderStatus = durationSeconds > 0 || videoTrackCount > 0 || container.audioTrackCount > 0
    ? 'ready'
    : (mediaElement.canPlayMp4 === false ? 'unsupported' : 'error')
  return {
    audioTrackCount: container.audioTrackCount,
    audioChannelCount: container.audioChannelCount,
    audioSampleRate: container.audioSampleRate,
    averageVideoBitrate: container.averageVideoBitrate,
    averageVideoFrameRate: container.averageVideoFrameRate,
    canDecodeAudio: canDecodeCodec(container.primaryAudioCodec, 'audio'),
    canDecodeVideo: canDecodeCodec(container.primaryVideoCodec, 'video') ?? mediaElement.canPlayMp4,
    displayHeight,
    displayWidth,
    durationSeconds,
    durationSource: container.durationSeconds ? 'computed' : (mediaElement.durationSeconds ? 'metadata' : ''),
    primaryAudioCodec: container.primaryAudioCodec,
    primaryVideoCodec: container.primaryVideoCodec,
    status,
    thumbnailHeight: thumbnails[0]?.height || 0,
    thumbnails,
    thumbnailWidth: thumbnails[0]?.width || 0,
    timeResolution: container.timeResolution,
    videoTrackCount,
  }
}

export function loadTimelineMediaReaderSummary(url: string): Promise<TimelineMediaReaderSummary> {
  const key = clean(url)
  if (!key) return Promise.resolve(EMPTY_TIMELINE_MEDIA_READER_SUMMARY)
  const cached = TIMELINE_MEDIA_READER_CACHE.get(key)
  if (cached) return cached
  const pending = loadTimelineMediaReaderSummaryUncached(key)
  TIMELINE_MEDIA_READER_CACHE.set(key, pending)
  return pending
}

export function useTimelineMediaReaderSummary(args: {
  active: boolean
  url: string
}): TimelineMediaReaderSummary {
  const url = clean(args.url)
  const [summary, setSummary] = React.useState<TimelineMediaReaderSummary>(EMPTY_TIMELINE_MEDIA_READER_SUMMARY)

  React.useEffect(() => {
    if (!args.active || !url) {
      setSummary(EMPTY_TIMELINE_MEDIA_READER_SUMMARY)
      return
    }
    let cancelled = false
    setSummary({ ...EMPTY_TIMELINE_MEDIA_READER_SUMMARY, status: 'loading' })
    void loadTimelineMediaReaderSummary(url).then(nextSummary => {
      if (cancelled) return
      setSummary(nextSummary)
    })
    return () => {
      cancelled = true
    }
  }, [args.active, url])

  return summary
}
