import React from 'react'

let bootstrapReady = false
const listeners = new Set<() => void>()

export function markSourceFilesBootstrapReady(): void {
  if (bootstrapReady) return
  bootstrapReady = true
  for (const listener of listeners) listener()
}

export function readSourceFilesBootstrapReady(): boolean {
  return bootstrapReady
}

export function subscribeSourceFilesBootstrapReady(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSourceFilesBootstrapReady(): boolean {
  return React.useSyncExternalStore(
    subscribeSourceFilesBootstrapReady,
    readSourceFilesBootstrapReady,
    () => false,
  )
}
