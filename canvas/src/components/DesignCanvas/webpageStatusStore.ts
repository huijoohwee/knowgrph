export type WebpageStatusUiState = {
  progress: number
  message: string
}

export type WebpageStatusUiStore = {
  getState: () => WebpageStatusUiState
  setState: (patch: Partial<WebpageStatusUiState>) => void
  subscribe: (listener: () => void) => () => void
}

export function createWebpageStatusUiStore(): WebpageStatusUiStore {
  let state: WebpageStatusUiState = { progress: 0, message: '' }
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setState: patch => {
      const next = { ...state, ...patch }
      if (next.progress === state.progress && next.message === state.message) return
      state = next
      listeners.forEach(listener => listener())
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
