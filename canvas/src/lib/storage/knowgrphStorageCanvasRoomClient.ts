import { readEnvString } from '@/lib/config.env'
import { buildKnowgrphStorageAbsoluteUrl } from '@/lib/storage/knowgrphStorageChatClient'
import { buildKnowgrphStorageCanvasRoomPath } from '@/lib/storage/knowgrphStorageSyncContract'

const normalizeString = (value: unknown): string => String(value || '').trim()

export type KnowgrphStorageCanvasRoomConfig = {
  baseUrl: string
  workspaceId: string
  sessionToken: string
}

export const readKnowgrphStorageCanvasRoomConfig = (): KnowgrphStorageCanvasRoomConfig | null => {
  const baseUrl = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', ''))
  const workspaceId = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_WORKSPACE_ID', ''))
  const sessionToken = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_CHAT_SESSION_TOKEN', ''))
  if (!baseUrl || !workspaceId || !sessionToken) return null
  return { baseUrl, workspaceId, sessionToken }
}

export const buildKnowgrphStorageCanvasRoomAbsoluteUrl = (
  config: KnowgrphStorageCanvasRoomConfig,
  roomId: string,
): string | null => {
  return buildKnowgrphStorageAbsoluteUrl(
    config.baseUrl,
    buildKnowgrphStorageCanvasRoomPath(config.workspaceId, roomId),
  )
}

export const buildKnowgrphStorageCanvasRoomWebSocketUrl = (
  config: KnowgrphStorageCanvasRoomConfig,
  roomId: string,
): string | null => {
  const absoluteUrl = buildKnowgrphStorageCanvasRoomAbsoluteUrl(config, roomId)
  if (!absoluteUrl) return null
  try {
    const url = new URL(absoluteUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('kg_session_token', config.sessionToken)
    return url.toString()
  } catch {
    return null
  }
}

