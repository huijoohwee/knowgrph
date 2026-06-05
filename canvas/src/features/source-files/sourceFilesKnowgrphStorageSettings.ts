import { readEnvString } from '@/lib/config.env'

const normalizeString = (value: unknown): string => String(value || '').trim()

export const readKnowgrphStorageBaseUrl = (): string =>
  normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', ''))

export const readKnowgrphStorageRuntimeSyncEnabled = (): boolean => {
  const raw = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_RUNTIME_SYNC_ENABLED', '')).toLowerCase()
  if (!raw) return false
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no')
}
