export const CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT = '/chat-log'

const LEGACY_CHAT_LOCAL_STORAGE_ROOT_PATHS = new Set([
  '/chats',
  'chats',
  '/sandbox/chat-log',
  'sandbox/chat-log',
])

export const normalizeChatLocalStorageRootPath = (value: string | null | undefined): string => {
  const raw = String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!raw) return CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT
  if (LEGACY_CHAT_LOCAL_STORAGE_ROOT_PATHS.has(raw)) return CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT
  return raw
}
