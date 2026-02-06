import React from 'react'

import { type LsStorageKey } from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'

export function usePinnedLs(storageKey: LsStorageKey, defaultPinned: boolean): {
  pinned: boolean
  setPinned: (next: boolean | ((prev: boolean) => boolean)) => void
  togglePinned: () => void
} {
  const [pinned, setPinnedState] = React.useState<boolean>(() => lsBool(storageKey, defaultPinned))

  const setPinned = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setPinnedState(prev => {
        const resolved = typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next
        lsSetBool(storageKey, resolved)
        return resolved
      })
    },
    [storageKey],
  )

  const togglePinned = React.useCallback(() => {
    setPinned(v => !v)
  }, [setPinned])

  return { pinned, setPinned, togglePinned }
}
