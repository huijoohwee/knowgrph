import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useSourceFilesBootstrapReady } from '@/features/source-files/sourceFilesBootstrapReadiness'
import { isNativeXrRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'

const AgenticOsRemoteGrammarAutoHydrationContext = React.createContext(true)

export function resolveAgenticOsRemoteGrammarAutoHydration(args: {
  sourceFilesReady: boolean
  offlineNativeXrActive: boolean
}): boolean {
  return args.sourceFilesReady && !args.offlineNativeXrActive
}

export function AgenticOsRemoteGrammarAutoHydrationBoundary(props: {
  children: React.ReactNode
}): React.ReactElement {
  const sourceFilesReady = useSourceFilesBootstrapReady()
  const offlineNativeXrActive = useGraphStore(state => (
    isNativeXrRunReadyDemoActive(
      state.markdownDocumentName,
      state.markdownDocumentText,
    )
  ))
  const autoHydrationAllowed = resolveAgenticOsRemoteGrammarAutoHydration({
    sourceFilesReady,
    offlineNativeXrActive,
  })
  return (
    <AgenticOsRemoteGrammarAutoHydrationContext.Provider value={autoHydrationAllowed}>
      {props.children}
    </AgenticOsRemoteGrammarAutoHydrationContext.Provider>
  )
}

export function useAgenticOsRemoteGrammarAutoHydration(): boolean {
  return React.useContext(AgenticOsRemoteGrammarAutoHydrationContext)
}
