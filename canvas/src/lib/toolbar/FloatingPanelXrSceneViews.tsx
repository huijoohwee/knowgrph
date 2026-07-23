import React from 'react'
import type { FloatingPanelView } from '@/hooks/store/store-types/graph-state-chat-import'

const MediaCatalogPanelLazy = React.lazy(() => import('@/features/command-menu/CommandMenuCatalogPanel'))
const XrAnimationFloatingPanelViewLazy = React.lazy(() => import('@/features/three/XrAnimationFloatingPanelView'))
const MotionControlFloatingPanelViewLazy = React.lazy(() => import('@/features/three/MotionControlFloatingPanelView'))
const GameModeFloatingPanelViewLazy = React.lazy(() => import('@/features/game-fps/GameModeFloatingPanelView'))
const FlightSimFloatingPanelViewLazy = React.lazy(() => import('@/features/game-flight-sim/FlightSimFloatingPanelView'))
const StrybldrCameraFloatingPanelViewLazy = React.lazy(() =>
  import('@/features/strybldr/StrybldrCameraFloatingPanelView').then(mod => ({
    default: mod.StrybldrCameraFloatingPanelView,
  })),
)

export function FloatingPanelXrSceneView({ view }: { view: FloatingPanelView }) {
  const panel = view === 'media' ? <MediaCatalogPanelLazy />
    : view === 'animation' ? <XrAnimationFloatingPanelViewLazy />
      : view === 'motionControl' ? <MotionControlFloatingPanelViewLazy />
        : view === 'gameMode' ? <GameModeFloatingPanelViewLazy />
          : view === 'flightSim' ? <FlightSimFloatingPanelViewLazy />
            : view === 'camera' ? <StrybldrCameraFloatingPanelViewLazy />
              : null
  return panel ? <React.Suspense fallback={null}>{panel}</React.Suspense> : null
}
