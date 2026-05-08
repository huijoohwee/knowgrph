import { LS_KEYS } from '@/lib/config'
import { readEnvString } from '@/lib/config.env'
import { getLocalStorage, lsBool, lsInt, lsSetBool, lsSetInt } from '@/lib/persistence'

const SETTINGS_EVENT = 'kg:workspace-store-sync-settings:changed'
const SEED_SYNC_POLL_MIN_MS = 1000
const SEED_SYNC_POLL_MAX_MS = 60_000
const SEED_SYNC_IDLE_MAX_MS_DEFAULT = 30_000
const SEED_SYNC_IDLE_MAX_MS_MIN = 1000
const SEED_SYNC_IDLE_MAX_MS_MAX = 300_000
const SOURCE_FILES_SYNC_DEBOUNCE_MIN_MS = 100
const SOURCE_FILES_SYNC_DEBOUNCE_MAX_MS = 10_000

const parseEnvBoolean = (name: string, fallback: boolean): boolean => {
  const raw = String(readEnvString(name, fallback ? 'true' : 'false') || '')
    .trim()
    .toLowerCase()
  if (!raw) return fallback
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no')
}

const parseEnvSeedSyncPollMs = (): number => {
  const raw = Number.parseInt(readEnvString('VITE_WORKSPACE_SEED_SYNC_POLL_MS', '3000'), 10)
  if (!Number.isFinite(raw)) return 3000
  return Math.min(SEED_SYNC_POLL_MAX_MS, Math.max(SEED_SYNC_POLL_MIN_MS, raw))
}

const notifyWorkspaceStoreSyncSettingsChanged = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(SETTINGS_EVENT))
  } catch {
    void 0
  }
}

export const subscribeWorkspaceStoreSyncSettingsChanged = (
  cb: () => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => void 0
  const handler = () => {
    cb()
  }
  window.addEventListener(SETTINGS_EVENT, handler)
  return () => {
    window.removeEventListener(SETTINGS_EVENT, handler)
  }
}

export const readWorkspaceSeedSyncEnabledSetting = (): boolean => {
  return lsBool(LS_KEYS.workspaceSeedSyncEnabled, parseEnvBoolean('VITE_WORKSPACE_SEED_SYNC_ENABLED', true))
}

export const writeWorkspaceSeedSyncEnabledSetting = (next: boolean): boolean => {
  const written = lsSetBool(LS_KEYS.workspaceSeedSyncEnabled, !!next)
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceSeedSyncPollMsSetting = (): number => {
  return lsInt(LS_KEYS.workspaceSeedSyncPollMs, parseEnvSeedSyncPollMs())
}

export const writeWorkspaceSeedSyncPollMsSetting = (next: number): number => {
  const written = lsSetInt(LS_KEYS.workspaceSeedSyncPollMs, next, {
    min: SEED_SYNC_POLL_MIN_MS,
    max: SEED_SYNC_POLL_MAX_MS,
  })
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceSeedSyncIdleMaxMsSetting = (): number => {
  return lsInt(LS_KEYS.workspaceSeedSyncIdleMaxMs, SEED_SYNC_IDLE_MAX_MS_DEFAULT)
}

export const writeWorkspaceSeedSyncIdleMaxMsSetting = (next: number): number => {
  const written = lsSetInt(LS_KEYS.workspaceSeedSyncIdleMaxMs, next, {
    min: SEED_SYNC_IDLE_MAX_MS_MIN,
    max: SEED_SYNC_IDLE_MAX_MS_MAX,
  })
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceAutoRefreshEnabledSetting = (): boolean => {
  return lsBool(LS_KEYS.workspaceAutoRefreshEnabled, true)
}

export const writeWorkspaceAutoRefreshEnabledSetting = (next: boolean): boolean => {
  const written = lsSetBool(LS_KEYS.workspaceAutoRefreshEnabled, !!next)
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceSourceFilesDocsOnlySetting = (): boolean => {
  return lsBool(LS_KEYS.workspaceSourceFilesDocsOnly, true)
}

export const writeWorkspaceSourceFilesDocsOnlySetting = (next: boolean): boolean => {
  const written = lsSetBool(LS_KEYS.workspaceSourceFilesDocsOnly, !!next)
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceSourceFilesSyncDebounceMsSetting = (): number => {
  return lsInt(LS_KEYS.workspaceSourceFilesSyncDebounceMs, 1200)
}

export const writeWorkspaceSourceFilesSyncDebounceMsSetting = (next: number): number => {
  const written = lsSetInt(LS_KEYS.workspaceSourceFilesSyncDebounceMs, next, {
    min: SOURCE_FILES_SYNC_DEBOUNCE_MIN_MS,
    max: SOURCE_FILES_SYNC_DEBOUNCE_MAX_MS,
  })
  notifyWorkspaceStoreSyncSettingsChanged()
  return written
}

export const readWorkspaceImportDefaultSourceUrlSetting = (): string => {
  const storage = getLocalStorage()
  if (!storage) return ''
  try {
    return String(storage.getItem(LS_KEYS.workspaceImportDefaultSourceUrl) || '').trim()
  } catch {
    return ''
  }
}

export const writeWorkspaceImportDefaultSourceUrlSetting = (next: string): void => {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    const value = String(next || '').trim()
    if (value) {
      storage.setItem(LS_KEYS.workspaceImportDefaultSourceUrl, value)
    } else {
      storage.removeItem(LS_KEYS.workspaceImportDefaultSourceUrl)
    }
    notifyWorkspaceStoreSyncSettingsChanged()
  } catch {
    void 0
  }
}
