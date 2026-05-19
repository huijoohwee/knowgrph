import type { LsStorageKey } from '@/lib/config'
import { lsBool, lsFloat, lsJson, lsSetBool, lsSetFloat, lsSetJson } from '@/lib/persistence'
import type { SettingMeta } from './types'

const normalizeString = (value: unknown, fallback = ''): string => {
  const next = typeof value === 'string' ? value.trim() : ''
  return next || fallback
}

const normalizeJsonText = (value: unknown, fallback: string): string => (
  typeof value === 'string' ? value : fallback
)

export const localStringSetting = (args: {
  key: string
  storageKey: LsStorageKey
  defaultValue: string
  docKey?: string
  options?: string[]
}): SettingMeta => ({
  key: args.key,
  type: 'string',
  source: 'localStorage',
  read: () => lsJson<string>(args.storageKey, args.defaultValue, value => normalizeString(value, args.defaultValue)),
  write: value => {
    const next = args.options?.length
      ? (args.options.includes(String(value ?? '').trim()) ? String(value ?? '').trim() : args.defaultValue)
      : normalizeString(value, args.defaultValue)
    lsSetJson(args.storageKey, next)
  },
  default: () => args.defaultValue,
  options: args.options,
  docKey: args.docKey,
})

export const localJsonSetting = (args: {
  key: string
  storageKey: LsStorageKey
  defaultValue: string
  docKey?: string
}): SettingMeta => ({
  key: args.key,
  type: 'json',
  source: 'localStorage',
  read: () => lsJson<string>(args.storageKey, args.defaultValue, value => normalizeJsonText(value, args.defaultValue)),
  write: value => {
    lsSetJson(args.storageKey, typeof value === 'string' ? value : args.defaultValue)
  },
  default: () => args.defaultValue,
  docKey: args.docKey,
})

export const localNumberSetting = (args: {
  key: string
  storageKey: LsStorageKey
  defaultValue: number
  min?: number
  max?: number
  docKey?: string
}): SettingMeta => ({
  key: args.key,
  type: 'number',
  source: 'localStorage',
  read: () => lsFloat(args.storageKey, args.defaultValue, {
    ...(typeof args.min === 'number' ? { min: args.min } : {}),
    ...(typeof args.max === 'number' ? { max: args.max } : {}),
  }),
  write: value => {
    lsSetFloat(args.storageKey, Number(value), {
      ...(typeof args.min === 'number' ? { min: args.min } : {}),
      ...(typeof args.max === 'number' ? { max: args.max } : {}),
    })
  },
  default: () => args.defaultValue,
  docKey: args.docKey,
})

export const localBooleanSetting = (args: {
  key: string
  storageKey: LsStorageKey
  defaultValue: boolean
  docKey?: string
}): SettingMeta => ({
  key: args.key,
  type: 'boolean',
  source: 'localStorage',
  read: () => lsBool(args.storageKey, args.defaultValue),
  write: value => {
    lsSetBool(args.storageKey, Boolean(value))
  },
  default: () => args.defaultValue,
  docKey: args.docKey,
})
