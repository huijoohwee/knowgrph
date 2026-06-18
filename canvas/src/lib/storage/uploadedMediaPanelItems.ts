import {
  buildUploadedMediaAccessUrl,
  type UploadedMediaStorageResult,
} from '@/lib/storage/uploadedMediaStorage'

export type UploadedMediaPanelItem = {
  id: string
  name: string
  kind: 'image' | 'audio' | 'video'
  localUrl: string
  linkUrl: string
  contentType: string
  sizeBytes: number
  status: 'uploading' | 'synced' | 'local'
  storage: UploadedMediaStorageResult | null
  error: string | null
}

export const UPLOADED_MEDIA_PANEL_STORAGE_KEY = 'knowgrph:floating-panel-media:uploaded-cloudflare-items:v1'
export const UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT = 'knowgrph:floating-panel-media:uploaded-items-changed'

export const isUploadedMediaPanelItemKind = (value: unknown): value is UploadedMediaPanelItem['kind'] =>
  value === 'image' || value === 'audio' || value === 'video'

export const buildUploadedMediaPanelItemId = (storage: Pick<UploadedMediaStorageResult, 'contentHash' | 'objectKey'>): string =>
  `cloudflare-media:${String(storage.contentHash || storage.objectKey).trim()}`

export const readUploadedMediaPanelDedupeKey = (item: UploadedMediaPanelItem): string =>
  String(item.storage?.contentHash || item.storage?.objectKey || item.id).trim()

export function readUploadedMediaFileName(storage: UploadedMediaStorageResult): string {
  const fromProvenance = typeof storage.provenance?.fileName === 'string' ? storage.provenance.fileName.trim() : ''
  if (fromProvenance) return fromProvenance
  return storage.objectKey.split('/').filter(Boolean).at(-1) || storage.shotId || 'uploaded-media'
}

export const mergeUploadedMediaPanelItems = (items: UploadedMediaPanelItem[]): UploadedMediaPanelItem[] => {
  const nextByKey = new Map<string, UploadedMediaPanelItem>()
  for (const item of items) {
    const key = readUploadedMediaPanelDedupeKey(item)
    if (!key) continue
    const canonicalItem = item.storage
      ? { ...item, id: buildUploadedMediaPanelItemId(item.storage), linkUrl: item.storage.accessUrl || item.linkUrl }
      : item
    const existing = nextByKey.get(key)
    const existingHasLocalName = !!existing?.storage && existing.name !== readUploadedMediaFileName(existing.storage)
    const canonicalStorageName = canonicalItem.storage ? readUploadedMediaFileName(canonicalItem.storage) : canonicalItem.name
    if (!existing || (canonicalItem.status === 'synced' && existing.status !== 'synced') || (!existingHasLocalName && canonicalItem.name !== canonicalStorageName)) {
      nextByKey.set(key, canonicalItem)
    }
  }
  return Array.from(nextByKey.values())
}

export const readStoredUploadedMediaPanelItems = (): UploadedMediaPanelItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(value => {
      const item = value as Partial<UploadedMediaPanelItem>
      const storage = item.storage as UploadedMediaStorageResult | null
      if (!item.id || !item.name || !isUploadedMediaPanelItemKind(item.kind) || !storage?.publicUrl || !storage.runId) return []
      const accessUrl = buildUploadedMediaAccessUrl({ publicUrl: storage.publicUrl, runId: storage.runId })
      return [{
        id: buildUploadedMediaPanelItemId(storage),
        name: String(item.name),
        kind: item.kind,
        localUrl: '',
        linkUrl: accessUrl,
        contentType: String(item.contentType || storage.contentType || 'application/octet-stream'),
        sizeBytes: Number(item.sizeBytes || 0),
        status: 'synced' as const,
        storage: { ...storage, accessUrl },
        error: null,
      }]
    })
  } catch {
    return []
  }
}

export const writeStoredUploadedMediaPanelItems = (items: UploadedMediaPanelItem[]): void => {
  if (typeof window === 'undefined') return
  try {
    const syncedItems = mergeUploadedMediaPanelItems(items).filter(item => item.status === 'synced' && item.storage)
    window.localStorage.setItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY, JSON.stringify(syncedItems))
    window.dispatchEvent(new CustomEvent(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, { detail: syncedItems }))
  } catch {
    void 0
  }
}

export const buildUploadedMediaPanelItemFromStorage = (storage: UploadedMediaStorageResult): UploadedMediaPanelItem | null => {
  const kind = storage.stageId === 'image' || storage.stageId === 'audio' || storage.stageId === 'video' ? storage.stageId : null
  if (!kind) return null
  const sizeBytes = typeof storage.provenance?.sizeBytes === 'number' ? storage.provenance.sizeBytes : 0
  return {
    id: buildUploadedMediaPanelItemId(storage),
    name: readUploadedMediaFileName(storage),
    kind,
    localUrl: '',
    linkUrl: storage.accessUrl,
    contentType: storage.contentType,
    sizeBytes,
    status: 'synced',
    storage,
    error: null,
  }
}
