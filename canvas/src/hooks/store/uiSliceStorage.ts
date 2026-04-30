
import {
  getLocalStorage,
  readBoolFromStorage,
  readFloatFromStorage,
  readIntFromStorage,
  readJsonFromStorage,
  readNumFromStorage,
} from '@/lib/persistence'
import type { MonacoCapabilityLoadMode } from './types'

export const clampInt = (v: number, fallback: number, opts: { min: number; max: number }) => {
  const n = Number.isFinite(v) ? Math.floor(Number(v)) : fallback
  return n < opts.min ? opts.min : n > opts.max ? opts.max : n
}

export const clampFloat = (v: number, fallback: number, opts: { min: number; max: number }) => {
  const n = Number.isFinite(v) ? Number(v) : fallback
  return n < opts.min ? opts.min : n > opts.max ? opts.max : n
}

export const createUiStorageReaders = () => {
  const storage = getLocalStorage()
  const lsNum = (key: string, fallback: number) => readNumFromStorage(storage, key, fallback)
  const lsBool = (key: string, fallback: boolean) => readBoolFromStorage(storage, key, fallback)
  const lsInt = (key: string, fallback: number) => readIntFromStorage(storage, key, fallback)
  const lsFloat = (key: string, fallback: number, opts?: { min?: number; max?: number }) => readFloatFromStorage(storage, key, fallback, opts)
  const lsJson = <T>(key: string, fallback: T, parse: (raw: unknown) => T | null) => readJsonFromStorage(storage, key, fallback, parse)
  const readLsString = (key: string, fallback: string) => {
    if (!storage) return fallback
    try {
      const raw = storage.getItem(key)
      if (raw == null) return fallback
      const s = String(raw || '').trim()
      return s ? s : fallback
    } catch {
      return fallback
    }
  }
  const writeLsString = (key: string, value: string) => {
    const freshStorage = getLocalStorage()
    const next = String(value || '').trim()
    if (!freshStorage) return next
    try {
      freshStorage.setItem(key, next)
    } catch {
      void 0
    }
    return next
  }
  const readMonacoLoadMode = (key: string, fallback: MonacoCapabilityLoadMode = 'lazy'): MonacoCapabilityLoadMode => {
    const raw = readLsString(key, fallback)
    return raw === 'eager' ? 'eager' : 'lazy'
  }
  return { storage, lsNum, lsBool, lsInt, lsFloat, lsJson, readLsString, writeLsString, readMonacoLoadMode }
}

export type UiStorageReaders = ReturnType<typeof createUiStorageReaders>
