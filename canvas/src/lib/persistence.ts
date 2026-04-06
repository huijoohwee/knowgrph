import type { LsStorageKey, SessionStorageKey, StorageChannelKey } from '@/lib/config'
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'

const LS_COALESCED_WRITE_DELAY_MS = 80
const LS_COALESCED_TASK_PREFIX = 'ls:coalesced'
const LS_LAST_WRITTEN_LIMIT = 500

const lastWrittenValueByKey = new Map<string, string>()

const noteLastWrittenValue = (key: string, value: string): void => {
  if (!key) return
  if (lastWrittenValueByKey.has(key)) {
    lastWrittenValueByKey.delete(key)
  }
  lastWrittenValueByKey.set(key, value)
  if (lastWrittenValueByKey.size <= LS_LAST_WRITTEN_LIMIT) return
  const oldestKey = lastWrittenValueByKey.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    lastWrittenValueByKey.delete(oldestKey)
  }
}

const readLastWrittenValue = (key: string): string | null => {
  if (!key) return null
  return lastWrittenValueByKey.get(key) ?? null
}

export function readNumFromStorage(storage: Storage | null, key: string, fallback: number): number {
  if (!storage) return fallback
  try {
    const v = parseFloat(storage.getItem(key) || '')
    if (isNaN(v)) return fallback
    const x = Math.max(0, Math.min(1, v))
    return x
  } catch {
    return fallback
  }
}

export function writeNumToStorage(storage: Storage | null, key: string, value: number): number {
  const x = Math.max(0, Math.min(1, value))
  if (!storage) return x
  try {
    storage.setItem(key, String(x))
  } catch (err) {
    void err
  }
  return x
}

export function readBoolFromStorage(storage: Storage | null, key: string, fallback: boolean): boolean {
  if (!storage) return fallback
  try {
    const v = storage.getItem(key)
    if (v === null) return fallback
    return v === '1' || v === 'true'
  } catch {
    return fallback
  }
}

export function writeBoolToStorage(storage: Storage | null, key: string, value: boolean): boolean {
  const next = !!value
  if (!storage) return next
  try {
    storage.setItem(key, next ? '1' : '0')
  } catch (err) {
    void err
  }
  return next
}

export function readIntFromStorage(storage: Storage | null, key: string, fallback: number): number {
  if (!storage) return fallback
  try {
    const v = parseInt(storage.getItem(key) || '', 10)
    if (isNaN(v)) return fallback
    return v
  } catch {
    return fallback
  }
}

export function readFloatFromStorage(
  storage: Storage | null,
  key: string,
  fallback: number,
  opts?: { min?: number; max?: number },
): number {
  if (!storage) return fallback
  try {
    const v = parseFloat(storage.getItem(key) || '')
    if (!Number.isFinite(v)) return fallback
    const min = typeof opts?.min === 'number' && Number.isFinite(opts.min) ? opts.min : -Number.MAX_SAFE_INTEGER
    const max = typeof opts?.max === 'number' && Number.isFinite(opts.max) ? opts.max : Number.MAX_SAFE_INTEGER
    return Math.max(min, Math.min(max, v))
  } catch {
    return fallback
  }
}

export function writeFloatToStorage(
  storage: Storage | null,
  key: string,
  value: number,
  opts?: { min?: number; max?: number },
): number {
  const safe = Number.isFinite(value) ? value : 0
  const min = typeof opts?.min === 'number' && Number.isFinite(opts.min) ? opts.min : -Number.MAX_SAFE_INTEGER
  const max = typeof opts?.max === 'number' && Number.isFinite(opts.max) ? opts.max : Number.MAX_SAFE_INTEGER
  const x = Math.max(min, Math.min(max, safe))
  if (!storage) return x
  try {
    storage.setItem(key, String(x))
  } catch {
    void 0
  }
  return x
}

export function writeIntToStorage(
  storage: Storage | null,
  key: string,
  value: number,
  opts?: { min?: number; max?: number },
): number {
  const min = typeof opts?.min === 'number' ? opts.min : 1
  const max = typeof opts?.max === 'number' ? opts.max : 1024
  const x = Math.max(min, Math.min(max, Math.floor(value)))
  if (!storage) return x
  try {
    storage.setItem(key, String(x))
  } catch (err) {
    void err
  }
  return x
}

export function readJsonFromStorage<T>(
  storage: Storage | null,
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): T {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    const parsed = parse(JSON.parse(raw) as unknown)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function writeJsonToStorage<T>(storage: Storage | null, key: string, value: T): T {
  if (!storage) return value
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    void 0
  }
  return value
}

export const getLocalStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export const lsNum = (key: LsStorageKey, fallback: number) => {
  const storage = getLocalStorage()
  return readNumFromStorage(storage, key, fallback)
};

export const lsSetNum = (key: LsStorageKey, value: number) => {
  const storage = getLocalStorage()
  return writeNumToStorage(storage, key, value)
};

export const lsBool = (key: LsStorageKey, fallback: boolean) => {
  const storage = getLocalStorage()
  return readBoolFromStorage(storage, key, fallback)
};

export const lsSetBool = (key: LsStorageKey, value: boolean) => {
  const storage = getLocalStorage()
  return writeBoolToStorage(storage, key, value)
};

export const lsInt = (key: LsStorageKey, fallback: number) => {
  const storage = getLocalStorage()
  return readIntFromStorage(storage, key, fallback)
};

export const lsSetInt = (key: LsStorageKey, value: number, opts?: { min?: number; max?: number }) => {
  const storage = getLocalStorage()
  return writeIntToStorage(storage, key, value, opts)
};

export const lsFloat = (key: LsStorageKey, fallback: number, opts?: { min?: number; max?: number }) => {
  const storage = getLocalStorage()
  return readFloatFromStorage(storage, key, fallback, opts)
}

export const lsSetFloat = (key: LsStorageKey, value: number, opts?: { min?: number; max?: number }) => {
  const storage = getLocalStorage()
  return writeFloatToStorage(storage, key, value, opts)
}

export const lsJson = <T>(key: LsStorageKey, fallback: T, parse: (raw: unknown) => T | null) => {
  const storage = getLocalStorage()
  return readJsonFromStorage(storage, key, fallback, parse)
};

export const lsSetJson = <T>(key: LsStorageKey, value: T) => {
  const storage = getLocalStorage()
  return writeJsonToStorage(storage, key, value)
};

type CoalescedWriteOptions = {
  delayMs?: number
  /**
   * When provided, prevents redundant scheduling/execution without needing to
   * stringify/serialize the payload.
   */
  signature?: string | null
}

export const lsSetJsonCoalesced = <T>(key: LsStorageKey, value: T, opts?: CoalescedWriteOptions): T => {
  const safeKey = String(key || '').trim()
  if (!safeKey) return value
  const delayMs = typeof opts?.delayMs === 'number' && Number.isFinite(opts.delayMs) ? Math.max(0, Math.floor(opts.delayMs)) : LS_COALESCED_WRITE_DELAY_MS
  const signature = typeof opts?.signature === 'string' && opts.signature.length > 0 ? opts.signature : null
  const taskKey = `${LS_COALESCED_TASK_PREFIX}:json:${safeKey}`
  scheduleWorkspaceSyncTask(taskKey, () => {
    const storage = getLocalStorage()
    if (!storage) return
    try {
      const nextRaw = JSON.stringify(value)
      const lastRaw = readLastWrittenValue(taskKey)
      if (lastRaw === nextRaw) return
      storage.setItem(safeKey, nextRaw)
      noteLastWrittenValue(taskKey, nextRaw)
    } catch {
      void 0
    }
  }, delayMs, { signature })
  return value
}

export const lsSetIntCoalesced = (
  key: LsStorageKey,
  value: number,
  opts?: { min?: number; max?: number } & CoalescedWriteOptions,
): number => {
  const safeKey = String(key || '').trim()
  if (!safeKey) return value
  const delayMs = typeof opts?.delayMs === 'number' && Number.isFinite(opts.delayMs) ? Math.max(0, Math.floor(opts.delayMs)) : LS_COALESCED_WRITE_DELAY_MS
  const signature = typeof opts?.signature === 'string' && opts.signature.length > 0 ? opts.signature : null
  const min = typeof opts?.min === 'number' ? opts.min : 1
  const max = typeof opts?.max === 'number' ? opts.max : 1024
  const x = Math.max(min, Math.min(max, Math.floor(value)))
  const taskKey = `${LS_COALESCED_TASK_PREFIX}:int:${safeKey}`
  const effectiveSignature =
    typeof signature === 'string' && signature.length > 0 ? signature : String(x)
  scheduleWorkspaceSyncTask(taskKey, () => {
    const storage = getLocalStorage()
    if (!storage) return
    const nextRaw = String(x)
    const lastRaw = readLastWrittenValue(taskKey)
    if (lastRaw === nextRaw) return
    try {
      storage.setItem(safeKey, nextRaw)
      noteLastWrittenValue(taskKey, nextRaw)
    } catch {
      void 0
    }
  }, delayMs, { signature: effectiveSignature })
  return x
}

export const lsSetBoolCoalesced = (key: LsStorageKey, value: boolean, opts?: CoalescedWriteOptions): boolean => {
  const safeKey = String(key || '').trim()
  if (!safeKey) return !!value
  const delayMs = typeof opts?.delayMs === 'number' && Number.isFinite(opts.delayMs) ? Math.max(0, Math.floor(opts.delayMs)) : LS_COALESCED_WRITE_DELAY_MS
  const next = !!value
  const signature = typeof opts?.signature === 'string' && opts.signature.length > 0 ? opts.signature : String(next)
  const taskKey = `${LS_COALESCED_TASK_PREFIX}:bool:${safeKey}`
  scheduleWorkspaceSyncTask(taskKey, () => {
    const storage = getLocalStorage()
    if (!storage) return
    const nextRaw = next ? '1' : '0'
    const lastRaw = readLastWrittenValue(taskKey)
    if (lastRaw === nextRaw) return
    try {
      storage.setItem(safeKey, nextRaw)
      noteLastWrittenValue(taskKey, nextRaw)
    } catch {
      void 0
    }
  }, delayMs, { signature })
  return next
}

export const lsRemove = (key: LsStorageKey): void => {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    void 0
  }
};

export const getSessionStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null
    return window.sessionStorage
  } catch {
    return null
  }
};

export const ssString = (
  key: SessionStorageKey | StorageChannelKey,
  fallback: string,
): string => {
  const storage = getSessionStorage()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    return raw
  } catch {
    return fallback
  }
}

export const ssSetString = (
  key: SessionStorageKey | StorageChannelKey,
  value: string,
  ): string => {
  const storage = getSessionStorage()
  const next = String(value ?? '')
  if (!storage) return next
  try {
    storage.setItem(key, next)
  } catch {
    void 0
  }
  return next
}

export const ssRemove = (key: SessionStorageKey | StorageChannelKey): void => {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    void 0
  }
}

export const ssJson = <T>(key: SessionStorageKey | StorageChannelKey, fallback: T, parse: (raw: unknown) => T | null) => {
  const storage = getSessionStorage()
  return readJsonFromStorage(storage, key, fallback, parse)
};

export const ssSetJson = <T>(key: SessionStorageKey | StorageChannelKey, value: T) => {
  const storage = getSessionStorage()
  return writeJsonToStorage(storage, key, value)
};
