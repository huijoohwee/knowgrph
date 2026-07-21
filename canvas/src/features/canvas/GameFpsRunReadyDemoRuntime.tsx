import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isGameFpsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import {
  acknowledgeGameFpsDecisions,
  readGameFpsSnapshot,
  startGameFpsMission,
  stopGameFpsMission,
  subscribeGameFpsSnapshot,
} from '@/features/game-fps/gameFpsRuntime'
import {
  loadGameFpsSavedDecisions,
  persistPendingGameFpsDecisions,
  queueGameFpsDecisions,
  reportGameFpsDecisionLoadFailure,
} from '@/features/game-fps/gameFpsDecisionStore'

export function GameFpsRunReadyDemoRuntime() {
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const active = isGameFpsRunReadyDemoActive(markdownDocumentName)
  const mission = React.useSyncExternalStore(
    subscribeGameFpsSnapshot,
    readGameFpsSnapshot,
    readGameFpsSnapshot,
  )
  const launchGenerationRef = React.useRef(0)
  const persistedDecisionKeyRef = React.useRef('')

  React.useLayoutEffect(() => {
    const generation = launchGenerationRef.current + 1
    launchGenerationRef.current = generation
    if (!active) {
      stopGameFpsMission()
      return undefined
    }
    const graph = useGraphStore.getState()
    graph.setCanvasRenderMode('3d')
    graph.setCanvas3dMode('3d')
    graph.setFloatingPanelOpen(false)
    graph.setBottomSurfaceCollapsed(true)
    void loadGameFpsSavedDecisions()
      .then(decisions => {
        if (launchGenerationRef.current !== generation) return
        startGameFpsMission({ decisions })
      })
      .catch(error => {
        reportGameFpsDecisionLoadFailure(error)
      })
    return () => {
      if (launchGenerationRef.current !== generation) return
      launchGenerationRef.current += 1
      stopGameFpsMission()
    }
  }, [active])

  React.useEffect(() => {
    if (
      !active
      || (mission.phase !== 'won' && mission.phase !== 'lost')
      || mission.pendingDecisions.length === 0
    ) return
    const key = mission.pendingDecisions.map(decision => decision.decisionId).sort().join('|')
    if (persistedDecisionKeyRef.current === key) return
    persistedDecisionKeyRef.current = key
    const decisions = [...mission.pendingDecisions]
    queueGameFpsDecisions(decisions)
    void persistPendingGameFpsDecisions().then(result => {
      if (result.status === 'saved') {
        acknowledgeGameFpsDecisions(decisions.map(decision => decision.decisionId))
      } else {
        persistedDecisionKeyRef.current = ''
      }
    })
  }, [active, mission.pendingDecisions, mission.phase, mission.revision])

  return null
}
