import { readActiveKnowgrphStorageWorkspaceId } from '@/features/source-files/sourceFileShareUrl'
import {
  readKnowgrphStorageBaseUrl,
  readKnowgrphStorageRuntimeSyncEnabled,
} from '@/features/source-files/sourceFilesKnowgrphStorageSettings'
import { resolveKnowgrphStorageApiUrl } from '@/lib/storage/knowgrphStorageClientSync'
import {
  KNOWGRPH_STORAGE_API_VERSION,
  KNOWGRPH_STORAGE_R2_MEDIA_OBJECT_PREFIX,
  buildKnowgrphStorageMediaAssetPersistPath,
  buildKnowgrphStorageMediaPath,
  type KnowgrphMediaArtifactKind,
  type KnowgrphMediaAssetPersistRequest,
  type KnowgrphMediaAssetPersistResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'

const normalizeString = (value: unknown): string => String(value || '').trim()

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

const hashBlobSha256 = async (blob: Blob): Promise<string | null> => {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return `sha256:${bytesToHex(new Uint8Array(digest))}`
  } catch {
    return null
  }
}

const encodeBase64Url = (value: string): string => {
  try {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  } catch {
    return ''
  }
}

export const buildUploadedMediaAccessUrl = (args: {
  publicUrl: string
  runId: string
  ttlMs?: number | null
}): string => {
  const publicUrl = normalizeString(args.publicUrl)
  const runId = normalizeString(args.runId)
  if (!publicUrl || !runId) return publicUrl
  const authToken = encodeBase64Url(JSON.stringify({
    runId,
    expiresAt: Date.now() + Math.max(60_000, args.ttlMs ?? 15 * 60 * 1000),
  }))
  if (!authToken) return publicUrl
  try {
    const url = new URL(publicUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid')
    url.searchParams.set('kg_media_token', authToken)
    return url.toString()
  } catch {
    return publicUrl
  }
}

const normalizeSlug = (value: string, fallback: string): string => {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

const readFileExtension = (file: File): string => {
  const fromName = normalizeString(file.name).match(/\.([a-z0-9]{1,12})$/i)?.[1]
  if (fromName) return fromName.toLowerCase()
  if (/^image\/png$/i.test(file.type)) return 'png'
  if (/^image\/jpe?g$/i.test(file.type)) return 'jpg'
  if (/^image\/webp$/i.test(file.type)) return 'webp'
  if (/^audio\/mpeg$/i.test(file.type)) return 'mp3'
  if (/^audio\/wav$/i.test(file.type)) return 'wav'
  if (/^video\/mp4$/i.test(file.type)) return 'mp4'
  if (/^video\/webm$/i.test(file.type)) return 'webm'
  return 'bin'
}

export const readUploadedMediaKind = (file: File): Extract<KnowgrphMediaArtifactKind, 'image' | 'audio' | 'video'> | null => {
  const type = normalizeString(file.type).toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  return null
}

export type UploadedMediaStorageResult = {
  workspaceId: string
  runId: string
  stageId: string
  shotId: string
  objectKey: string
  publicPath: string
  publicUrl: string
  accessUrl: string
  contentHash: string
  contentType: string
  response: KnowgrphMediaAssetPersistResponse
}

export const uploadMediaFileToKnowgrphStorage = async (args: {
  file: File
  collaborationRoomId?: string | null
  accessTtlSeconds?: number | null
  fetchImpl?: typeof fetch
  uploadNow?: boolean
}): Promise<UploadedMediaStorageResult | null> => {
  const kind = readUploadedMediaKind(args.file)
  if (!kind) return null
  const shouldUpload = typeof args.uploadNow === 'boolean'
    ? args.uploadNow
    : readKnowgrphStorageRuntimeSyncEnabled()
  if (!shouldUpload) return null
  const fetchImpl = args.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null)
  if (!fetchImpl) return null
  const workspaceId = readActiveKnowgrphStorageWorkspaceId()
  const contentHash = await hashBlobSha256(args.file)
  if (!workspaceId || !contentHash) return null

  const hashSlug = normalizeSlug(contentHash.replace(/^sha256:/, '').slice(0, 16), 'media')
  const nameSlug = normalizeSlug(args.file.name.replace(/\.[^.]+$/u, ''), kind)
  const runId = `upload-${hashSlug}`
  const stageId = kind
  const shotId = `${nameSlug}-${hashSlug}`
  const objectKey = `${KNOWGRPH_STORAGE_R2_MEDIA_OBJECT_PREFIX}/runs/${runId}/${stageId}/${shotId}.${readFileExtension(args.file)}`
  const publicPath = buildKnowgrphStorageMediaPath(objectKey)
  const baseUrl = readKnowgrphStorageBaseUrl()
  const publicUrl = resolveKnowgrphStorageApiUrl(publicPath, baseUrl)
  const contentType = normalizeString(args.file.type) || 'application/octet-stream'
  const accessUrl = buildUploadedMediaAccessUrl({ publicUrl, runId })
  const authToken = new URL(accessUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid').searchParams.get('kg_media_token') || ''
  if (!authToken) return null

  const writeResponse = await fetchImpl(resolveKnowgrphStorageApiUrl(publicPath, baseUrl), {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': contentType,
      'x-knowgrph-content-hash': contentHash,
    },
    body: args.file,
  })
  if (!writeResponse.ok) return null

  const persistRequest: KnowgrphMediaAssetPersistRequest = {
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    workspaceId,
    objectKey,
    runId,
    stageId,
    shotId,
    kind,
    durableR2Url: publicPath,
    contentHash,
    mediaType: contentType,
    provenance: {
      source: 'floatingPanel.media.upload',
      fileName: args.file.name,
      sizeBytes: args.file.size,
      uploadedAtMs: Date.now(),
    },
    layout: null,
    version: 1,
    presignedUrl: accessUrl,
    accessTtlSeconds: args.accessTtlSeconds ?? 15 * 60,
    collaborationRoomId: normalizeString(args.collaborationRoomId) || null,
  }
  const persistResponse = await fetchImpl(resolveKnowgrphStorageApiUrl(buildKnowgrphStorageMediaAssetPersistPath(), baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(persistRequest),
  })
  if (!persistResponse.ok) return null
  const response = await persistResponse.json().catch(() => null) as KnowgrphMediaAssetPersistResponse | null
  if (!response || response.ok !== true) return null
  return {
    workspaceId,
    runId,
    stageId,
    shotId,
    objectKey,
    publicPath,
    publicUrl,
    accessUrl,
    contentHash,
    contentType,
    response,
  }
}
