import { useCallback } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, LS_LEGACY_KEYS } from '@/lib/config'
import { useParserUIState } from '@/features/parsers/uiState'

export function useLaunchSpotlight() {
  const setEnableLaunchSpotlight = useGraphStore(s => s.setEnableLaunchSpotlight)
  const setLaunchSpotlightMode = useGraphStore(s => s.setLaunchSpotlightMode)
  const setStatusPanelPinned = useGraphStore(s => s.setStatusPanelPinned)
  const [spotlightDismissed, setSpotlightDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false, [LS_LEGACY_KEYS.launchSpotlightDismissed])
  return useCallback(
    (mode: 'tour' | 'stats' = 'tour') => {
      const { enableLaunchSpotlight, launchSpotlightMode, statusPanelPinned, schemaOpOk, schemaLintCount } = useGraphStore.getState()
      const nextMode: 'tour' | 'stats' = mode === 'stats' ? 'stats' : 'tour'
      if (nextMode === 'stats') {
        const { parserLoadOk, dataLoadOk } = useParserUIState.getState()
        const hasProblem =
          dataLoadOk === false ||
          parserLoadOk === false ||
          schemaOpOk === false ||
          (typeof schemaLintCount === 'number' && schemaLintCount > 0)

        const nextPinned = !statusPanelPinned
        setStatusPanelPinned(nextPinned)
        setLaunchSpotlightMode('stats')
        if (nextPinned || hasProblem) {
          setEnableLaunchSpotlight(true)
          setSpotlightDismissed(false)
          return
        }
        setEnableLaunchSpotlight(false)
        return
      }
      if (enableLaunchSpotlight && launchSpotlightMode === nextMode) {
        if (spotlightDismissed) {
          setSpotlightDismissed(false)
          return
        }
        setEnableLaunchSpotlight(false)
        return
      }
      setLaunchSpotlightMode(nextMode)
      setEnableLaunchSpotlight(true)
      setSpotlightDismissed(false)
    },
    [setEnableLaunchSpotlight, setLaunchSpotlightMode, setSpotlightDismissed, setStatusPanelPinned, spotlightDismissed],
  )
}
