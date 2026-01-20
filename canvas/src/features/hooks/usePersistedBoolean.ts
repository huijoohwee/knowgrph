import { useEffect, useState } from 'react'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'
import type { LsStorageKey, SchemaSubsectionStorageKey } from '@/lib/config'

function usePersistedBoolean(
  key: LsStorageKey,
  defaultValue: boolean,
): readonly [boolean, (next: boolean) => void]
function usePersistedBoolean(
  key: SchemaSubsectionStorageKey,
  defaultValue: boolean,
): readonly [boolean, (next: boolean) => void]
function usePersistedBoolean(key: LsStorageKey | SchemaSubsectionStorageKey, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const storage = getLocalStorage()
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
