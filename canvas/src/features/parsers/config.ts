import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'

export const PARSER_CACHE_MAX_SIZE = 300
export const PARSER_CACHE_TTL_MS = 2 * 60 * 1000

export const isTreeSitterEnabled = (): boolean => {
  try {
    const workerSupported = typeof Worker !== 'undefined'
    const urlSupported = typeof URL !== 'undefined' && typeof (import.meta as ImportMeta).url === 'string'
    const windowSupported = typeof window !== 'undefined'
    if (!workerSupported || !urlSupported || !windowSupported) return false
    return lsBool(LS_KEYS.parserTreeSitterEnabled, false)
  } catch {
    return false
  }
}
