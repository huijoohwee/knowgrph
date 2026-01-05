import { useEffect, useState } from 'react'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'
import type { LsStorageKey, SchemaSubsectionStorageKey } from '@/lib/config'

function tryMigrateLegacyKeys(storage: Storage | null, key: string, legacyKeys?: string[]) {
  if (!storage) return
  if (!Array.isArray(legacyKeys) || legacyKeys.length === 0) return
  try {
    const existing = storage.getItem(key)
    if (existing !== null) return
    for (const legacyKey of legacyKeys) {
      const raw = storage.getItem(legacyKey)
      if (raw === null) continue
      try {
        storage.setItem(key, raw)
        storage.removeItem(legacyKey)
      } catch {
        void 0
      }
      return
    }
  } catch {
    void 0
  }
}

function usePersistedBoolean(
  key: LsStorageKey,
  defaultValue: boolean,
  legacyKeys?: string[],
): readonly [boolean, (next: boolean) => void]
function usePersistedBoolean(
  key: SchemaSubsectionStorageKey,
  defaultValue: boolean,
  legacyKeys?: string[],
): readonly [boolean, (next: boolean) => void]
function usePersistedBoolean(key: LsStorageKey | SchemaSubsectionStorageKey, defaultValue: boolean, legacyKeys?: string[]) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const storage = getLocalStorage()
      tryMigrateLegacyKeys(storage, key, legacyKeys)
      return readBoolFromStorage(storage, key, defaultValue)
    } catch {
      return defaultValue
    }
  })
  useEffect(() => {
    try {
      const storage = getLocalStorage()
      writeBoolToStorage(storage, key, value)
    } catch {
      void 0
    }
  }, [key, value])
  return [value, setValue] as const
}

export default usePersistedBoolean
