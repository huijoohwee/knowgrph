import { inferMediaKindFromResourceUrl } from '@/lib/graph/mediaUrlKind'

export const MEDIA_DRAG_PAYLOAD_MIME = 'application/x-knowgrph-media+json'
export const MEDIA_POINTER_DRAG_PAYLOAD_CHANGE_EVENT = 'kg:media-pointer-drag-payload-change'
export const MEDIA_POINTER_DRAG_DROP_EVENT = 'kg:media-pointer-drag-drop'

export type MediaDragPayload = {
  kind: 'image' | 'audio' | 'video'
  url: string
  label: string
  thumbnailUrl?: string
  sourceKey?: string
}

const normalizeText = (value: unknown): string => String(value || '').trim()

type MediaDragWindow = Window & {
  __kgMediaPointerDragPayload?: MediaDragPayload
  __kgMediaPointerDragClear?: () => void
  __kgMediaPointerDragClearTimer?: number
  __kgMediaPointerDragReleased?: boolean
  __kgMediaPointerDragStartClientX?: number
  __kgMediaPointerDragStartClientY?: number
  __kgMediaPointerDragLastClientX?: number
  __kgMediaPointerDragLastClientY?: number
}

export type MediaPointerDragDropDetail = {
  payload: MediaDragPayload
  clientX: number
  clientY: number
  startClientX?: number
  startClientY?: number
}

const readFirstDraggedUrl = (value: unknown): string => {
  const text = normalizeText(value)
  if (!text) return ''
  return text
    .split(/\r?\n/g)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#')) || ''
}

const buildFallbackMediaDragPayload = (url: string): MediaDragPayload | null => {
  const cleanUrl = normalizeText(url)
  if (!cleanUrl) return null
  const kind = inferMediaKindFromResourceUrl(cleanUrl)
  if (kind === 'svg') {
    return {
      kind: 'image',
      url: cleanUrl,
      label: 'image',
    }
  }
  if (kind !== 'image' && kind !== 'audio' && kind !== 'video') return null
  return {
    kind,
    url: cleanUrl,
    label: kind,
  }
}

export function normalizeMediaDragPayload(value: unknown): MediaDragPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<MediaDragPayload>
  const kind = normalizeText(record.kind)
  const url = normalizeText(record.url)
  if (kind !== 'image' && kind !== 'audio' && kind !== 'video') return null
  if (!url) return null
  return {
    kind,
    url,
    label: normalizeText(record.label) || kind,
    thumbnailUrl: normalizeText(record.thumbnailUrl) || undefined,
    sourceKey: normalizeText(record.sourceKey) || undefined,
  }
}

export function writeMediaDragPayload(dataTransfer: DataTransfer, payload: MediaDragPayload): void {
  const normalized = normalizeMediaDragPayload(payload)
  if (!normalized) return
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(MEDIA_DRAG_PAYLOAD_MIME, JSON.stringify(normalized))
  dataTransfer.setData('text/uri-list', normalized.url)
  dataTransfer.setData('text/plain', normalized.url)
}

export function readMediaDragPayload(dataTransfer: DataTransfer): MediaDragPayload | null {
  const raw = dataTransfer.getData(MEDIA_DRAG_PAYLOAD_MIME)
  if (raw) {
    try {
      return normalizeMediaDragPayload(JSON.parse(raw))
    } catch {
      // Fall through to URL formats exposed by the same native drag operation.
    }
  }
  return buildFallbackMediaDragPayload(
    readFirstDraggedUrl(dataTransfer.getData('text/uri-list'))
    || readFirstDraggedUrl(dataTransfer.getData('text/plain')),
  )
}

export function hasMediaDragPayload(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types || [])
  return types.includes(MEDIA_DRAG_PAYLOAD_MIME) || types.includes('text/uri-list') || types.includes('text/plain')
}

export function beginMediaPointerDragPayload(payload: MediaDragPayload, origin?: { clientX: number; clientY: number }): void {
  const normalized = normalizeMediaDragPayload(payload)
  if (!normalized || typeof window === 'undefined') return
  const mediaWindow = window as MediaDragWindow
  const hasOrigin = Number.isFinite(origin?.clientX) && Number.isFinite(origin?.clientY)
  if (!hasOrigin && mediaWindow.__kgMediaPointerDragPayload && mediaWindow.__kgMediaPointerDragClear) {
    mediaWindow.__kgMediaPointerDragPayload = normalized
    window.dispatchEvent(new CustomEvent(MEDIA_POINTER_DRAG_PAYLOAD_CHANGE_EVENT))
    return
  }
  mediaWindow.__kgMediaPointerDragClear?.()
  const startClientX = hasOrigin ? origin!.clientX : Number.NaN
  const startClientY = hasOrigin ? origin!.clientY : Number.NaN
  const rememberPointer = (event: PointerEvent | MouseEvent) => {
    const currentWindow = window as MediaDragWindow
    currentWindow.__kgMediaPointerDragLastClientX = event.clientX
    currentWindow.__kgMediaPointerDragLastClientY = event.clientY
  }
  const rememberNativeDrag = (event: DragEvent) => {
    const currentWindow = window as MediaDragWindow
    currentWindow.__kgMediaPointerDragLastClientX = event.clientX
    currentWindow.__kgMediaPointerDragLastClientY = event.clientY
  }
  const clearSoon = () => {
    const currentWindow = window as MediaDragWindow
    if (currentWindow.__kgMediaPointerDragClearTimer) window.clearTimeout(currentWindow.__kgMediaPointerDragClearTimer)
    currentWindow.__kgMediaPointerDragClearTimer = window.setTimeout(() => {
      currentWindow.__kgMediaPointerDragClear?.()
    }, 250)
  }
  const clear = () => {
    const currentWindow = window as MediaDragWindow
    if (currentWindow.__kgMediaPointerDragClearTimer) window.clearTimeout(currentWindow.__kgMediaPointerDragClearTimer)
    delete currentWindow.__kgMediaPointerDragPayload
    delete currentWindow.__kgMediaPointerDragClear
    delete currentWindow.__kgMediaPointerDragClearTimer
    delete currentWindow.__kgMediaPointerDragReleased
    delete currentWindow.__kgMediaPointerDragStartClientX
    delete currentWindow.__kgMediaPointerDragStartClientY
    delete currentWindow.__kgMediaPointerDragLastClientX
    delete currentWindow.__kgMediaPointerDragLastClientY
    window.removeEventListener('pointerup', handleRelease, true)
    window.removeEventListener('mouseup', handleRelease, true)
    window.removeEventListener('dragend', handleRelease, true)
    window.removeEventListener('pointermove', rememberPointer, true)
    window.removeEventListener('mousemove', rememberPointer, true)
    window.removeEventListener('dragover', rememberNativeDrag, true)
    window.removeEventListener('mouseup', clearSoon)
    window.dispatchEvent(new CustomEvent(MEDIA_POINTER_DRAG_PAYLOAD_CHANGE_EVENT))
  }
  const handleRelease = (event: PointerEvent | MouseEvent | DragEvent) => {
    const currentWindow = window as MediaDragWindow
    const releaseClientX = Number.isFinite(currentWindow.__kgMediaPointerDragLastClientX) ? currentWindow.__kgMediaPointerDragLastClientX! : event.clientX
    const releaseClientY = Number.isFinite(currentWindow.__kgMediaPointerDragLastClientY) ? currentWindow.__kgMediaPointerDragLastClientY! : event.clientY
    finishMediaPointerDragPayloadAt(releaseClientX, releaseClientY)
  }
  mediaWindow.__kgMediaPointerDragPayload = normalized
  mediaWindow.__kgMediaPointerDragClear = clear
  mediaWindow.__kgMediaPointerDragReleased = false
  mediaWindow.__kgMediaPointerDragStartClientX = startClientX
  mediaWindow.__kgMediaPointerDragStartClientY = startClientY
  mediaWindow.__kgMediaPointerDragLastClientX = Number.NaN
  mediaWindow.__kgMediaPointerDragLastClientY = Number.NaN
  window.addEventListener('pointerup', handleRelease, { capture: true, once: true })
  window.addEventListener('mouseup', handleRelease, { capture: true, once: true })
  window.addEventListener('dragend', handleRelease, { capture: true, once: true })
  window.addEventListener('pointermove', rememberPointer, true)
  window.addEventListener('mousemove', rememberPointer, true)
  window.addEventListener('dragover', rememberNativeDrag, true)
  window.addEventListener('mouseup', clearSoon, { once: true })
  window.dispatchEvent(new CustomEvent(MEDIA_POINTER_DRAG_PAYLOAD_CHANGE_EVENT))
}

export function finishMediaPointerDragPayloadAt(clientX: number, clientY: number): void {
  if (typeof window === 'undefined') return
  const mediaWindow = window as MediaDragWindow
  const payload = normalizeMediaDragPayload(mediaWindow.__kgMediaPointerDragPayload)
  if (!payload || mediaWindow.__kgMediaPointerDragReleased) return
  mediaWindow.__kgMediaPointerDragReleased = true
  const releaseClientX = Number.isFinite(clientX) ? clientX : Number.isFinite(mediaWindow.__kgMediaPointerDragLastClientX) ? mediaWindow.__kgMediaPointerDragLastClientX! : Number.NaN
  const releaseClientY = Number.isFinite(clientY) ? clientY : Number.isFinite(mediaWindow.__kgMediaPointerDragLastClientY) ? mediaWindow.__kgMediaPointerDragLastClientY! : Number.NaN
  window.dispatchEvent(new CustomEvent<MediaPointerDragDropDetail>(MEDIA_POINTER_DRAG_DROP_EVENT, {
    detail: {
      payload,
      clientX: releaseClientX,
      clientY: releaseClientY,
      startClientX: mediaWindow.__kgMediaPointerDragStartClientX,
      startClientY: mediaWindow.__kgMediaPointerDragStartClientY,
    },
  }))
  if (mediaWindow.__kgMediaPointerDragClearTimer) window.clearTimeout(mediaWindow.__kgMediaPointerDragClearTimer)
  mediaWindow.__kgMediaPointerDragClearTimer = window.setTimeout(() => {
    mediaWindow.__kgMediaPointerDragClear?.()
  }, 250)
}

export function readMediaPointerDragPayload(): MediaDragPayload | null {
  if (typeof window === 'undefined') return null
  return normalizeMediaDragPayload((window as MediaDragWindow).__kgMediaPointerDragPayload)
}

export function clearMediaPointerDragPayload(): void {
  if (typeof window === 'undefined') return
  const mediaWindow = window as MediaDragWindow
  mediaWindow.__kgMediaPointerDragClear?.()
}
