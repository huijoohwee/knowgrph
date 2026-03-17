import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  SPOTLIGHT_STEPS,
  type SpotlightRequirementStatus,
} from '@/features/spotlight/config'
import { useSpotlightAnchor } from '@/features/spotlight/useSpotlightAnchor'
import { getSpotlightCardStyle } from '@/features/spotlight/positioning'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { getGraphCapabilities } from '@/lib/graph/helpers'
import Tooltip from '@/features/panels/ui/Tooltip'
import { LAUNCH_SPOTLIGHT_TOUR_TOOLTIP } from '@/lib/config'
import { emitGraphTraversalFloatingPanelOpen } from '@/features/panels/utils/graphTraversalFloatingPanel'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'

type LaunchSpotlightTourCardProps = {
  dismissed: boolean
  setDismissed: (next: boolean) => void
  step: number
  setStep: (next: number) => void
  ready: boolean
  minimized: boolean
  setMinimized: (next: boolean) => void
}

export function LaunchSpotlightTourCard({
  dismissed,
  setDismissed,
  step,
  setStep,
  ready,
  minimized,
  setMinimized,
}: LaunchSpotlightTourCardProps) {
  const enableSpotlight = useGraphStore(s => s.enableLaunchSpotlight)
  const mode = useGraphStore(s => s.launchSpotlightMode)
  const traversalHasRun = useGraphStore(s => s.aiKgTraversalRan)
  const graphData = useGraphStore(s => s.graphData)
  const setEnableLaunchSpotlight = useGraphStore(s => s.setEnableLaunchSpotlight)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  const graphCapabilities = React.useMemo(() => {
    return getGraphCapabilities(graphData as GraphData | null | undefined)
  }, [graphData])

  const steps = React.useMemo(() => SPOTLIGHT_STEPS, [])

  React.useEffect(() => {
    if (mode === 'stats') return
    if (!enableSpotlight || dismissed || !ready) return
    const total = steps.length
    const idx = Math.min(Math.max(step, 0), total - 1)
    const currentStep = steps[idx]
    if (currentStep.id === 1) {
      try {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'workflow' } }))
      } catch {
        void 0
      }
    } else if (currentStep.id === 2) {
      try {
        useGraphStore.getState().setWorkspaceViewMode('canvas')
      } catch {
        void 0
      }
    } else if (currentStep.id === 3) {
      try {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'workflow' } }))
      } catch {
        void 0
      }
    } else if (currentStep.id === 4) {
      emitGraphTraversalFloatingPanelOpen()
    } else if (currentStep.id === 5) {
      emitRendererPanelOpen()
    }
  }, [enableSpotlight, dismissed, ready, step, steps, mode])

  const total = steps.length
  const clampedIndex = Math.min(Math.max(step, 0), total - 1)
  const current = steps[clampedIndex]

  const requirementStatus: SpotlightRequirementStatus = React.useMemo(
    () => ({
      renderOpen: true,
      traversalRan: !graphCapabilities.supportsTraversalTour || traversalHasRun,
      datasetLoaded: !!graphData,
    }),
    [
      traversalHasRun,
      graphCapabilities.supportsTraversalTour,
      graphData,
    ],
  )

  const selector = mode === 'stats' ? null : current.targetSelector
  const { anchor, dragPos, cardRef, handleCardPointerDown } = useSpotlightAnchor({
    enabled: enableSpotlight,
    dismissed,
    ready,
    selector,
  })

  if (!enableSpotlight || dismissed || !ready || mode === 'stats') return null

  const requirements = current.requires || []
  const allSatisfied = requirements.every(key => requirementStatus[key])
  const canAdvance = clampedIndex === 0 || allSatisfied

  const handleDismiss = () => {
    setDismissed(true)
    setEnableLaunchSpotlight(false)
  }

  const handleMinimize = () => {
    setMinimized(true)
  }

  const handleReopen = () => {
    setMinimized(false)
  }

  const handleNext = () => {
    if (!canAdvance) return
    if (clampedIndex >= total - 1) {
      setDismissed(true)
    } else {
      setStep(clampedIndex + 1)
    }
  }

  const handleBack = () => {
    if (clampedIndex <= 0) return
    setStep(clampedIndex - 1)
  }

  const cardStyle = getSpotlightCardStyle(anchor, dragPos, minimized)

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-none">
      <div
        ref={cardRef}
        className={`pointer-events-auto rounded-xl border bg-white/95 shadow-lg px-4 py-3 max-w-xs w-80 ${
          minimized ? 'cursor-default' : 'cursor-move'
        } ${
          current.variant === 'primary' ? 'border-blue-200 shadow-blue-100/70' : 'border-gray-200 shadow-gray-200/60'
        }`}
        onPointerDown={minimized ? undefined : handleCardPointerDown}
        style={cardStyle}
      >
        {minimized ? (
          <div className="flex items-center justify-between">
            <span className={`${uiPanelKeyValueTextSizeClass} text-gray-600`}>
              {current.title} ({clampedIndex + 1}/{total})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-transparent text-gray-500 hover:bg-gray-100`}
                onClick={handleDismiss}
              >
                Dismiss
              </button>
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-blue-600 text-blue-600 hover:bg-blue-50`}
                onClick={handleReopen}
              >
                Reopen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-1">
              <div className="flex flex-col gap-0.5">
                <span
                  className={`${uiPanelKeyValueTextSizeClass} font-medium uppercase tracking-wide ${
                    current.variant === 'primary' ? 'text-blue-600' : 'text-gray-500'
                  }`}
                >
                  Launch tour
                </span>
                <Tooltip
                  content={LAUNCH_SPOTLIGHT_TOUR_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                >
                  <div className="flex items-center gap-1">
                    <div className="text-sm font-semibold text-gray-900">{current.title}</div>
                  </div>
                </Tooltip>
              </div>
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-transparent text-gray-500 hover:bg-gray-100`}
                onClick={handleMinimize}
              >
                Minimize
              </button>
            </div>
            <div className="text-xs text-gray-700 mb-2">{current.body}</div>
            {current.id === 2 && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${uiPanelKeyValueTextSizeClass} px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50`}
                  onClick={() => {
                    try {
                      useGraphStore.getState().setWorkspaceViewMode('canvas')
                    } catch {
                      void 0
                    }
                  }}
                >
                  Open Graph Data Table
                </button>
              </div>
            )}
            {!canAdvance && (
              <div className={`mb-2 flex items-center ${uiPanelKeyValueTextSizeClass} text-gray-600`}>
                <span>
                  {clampedIndex === 1
                    ? 'User loads a dataset via Load Data before continuing.'
                    : clampedIndex === 2
                    ? 'User opens Schema Configurator tab in bottom panel to apply schema presets.'
                    : clampedIndex === 3
                    ? 'User runs a traversal preset in the Renderer panel to complete this tour.'
                    : ''}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {steps.map((stepConfig, stepIndex) => (
                  <span
                    key={stepConfig.id}
                    className={`h-1.5 w-1.5 rounded-full ${
                      stepIndex === clampedIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${uiPanelKeyValueTextSizeClass} px-3 py-1 rounded border border-transparent text-gray-500 hover:bg-gray-100`}
                  onClick={handleBack}
                  disabled={clampedIndex === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={`${uiPanelKeyValueTextSizeClass} px-3 py-1 rounded border border-transparent text-gray-600 hover:bg-gray-100`}
                  onClick={handleDismiss}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className={`${uiPanelKeyValueTextSizeClass} px-3 py-1 rounded border ${
                    canAdvance
                      ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
                      : 'border-gray-300 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleNext}
                  disabled={!canAdvance}
                >
                  {clampedIndex >= total - 1 ? 'Done' : 'Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
