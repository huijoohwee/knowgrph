import { useEffect, useRef } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphState } from '@/hooks/useGraphStore'

export function useGraphStoreKeyRef<K extends keyof GraphState>(key: K) {
  const ref = useRef<GraphState[K]>(useGraphStore.getState()[key])
  useEffect(() => {
    return useGraphStore.subscribe(
      s => s[key],
      v => {
        ref.current = v
      },
    )
  }, [key])
  return ref
}

