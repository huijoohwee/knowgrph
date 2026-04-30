
import { SESSION_KEYS } from '@/lib/config.ls.keys'
import { ssSetString, ssString } from '@/lib/persistence'

const createSessionTabId = (): string =>
  `tab-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

export const readInitialSessionTabId = (): string => {
  try {
    return ssString(SESSION_KEYS.tabId, '') || 'tab-ssr'
  } catch {
    return 'tab-ssr'
  }
}

export const ensureSessionTabId = (): string => {
  try {
    const existing = ssString(SESSION_KEYS.tabId, '')
    if (existing) return existing
    const id = createSessionTabId()
    ssSetString(SESSION_KEYS.tabId, id)
    return id
  } catch {
    return 'tab-ssr'
  }
}
