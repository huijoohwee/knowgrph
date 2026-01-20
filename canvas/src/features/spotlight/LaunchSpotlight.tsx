import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useParserUIState } from '@/features/parsers/uiState'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import { LaunchSpotlightStatusCard } from '@/features/spotlight/LaunchSpotlightStatusCard'
import { LaunchSpotlightTourCard } from '@/features/spotlight/LaunchSpotlightTourCard'

export default function LaunchSpotlight() {
  const enableSpotlight = useGraphStore(s => s.enableLaunchSpotlight)
  const mode = useGraphStore(s => s.launchSpotlightMode)
  const schemaOpOk = useGraphStore(s => s.schemaOpOk)
  const schemaOpMsg = useGraphStore(s => s.schemaOpMsg)
  const schemaLintCount = useGraphStore(s => s.schemaLintCount)
  const graphFieldsOpOk = useGraphStore(s => s.graphFieldsOpOk)
  const graphFieldsOpMsg = useGraphStore(s => s.graphFieldsOpMsg)
  const orchestratorOpOk = useGraphStore(s => s.orchestratorOpOk)
  const orchestratorOpMsg = useGraphStore(s => s.orchestratorOpMsg)
  const renderOpOk = useGraphStore(s => s.renderOpOk)
  const renderOpMsg = useGraphStore(s => s.renderOpMsg)
  const lifecycleStage = useGraphStore(s => s.lifecycleStage)
  const setEnableLaunchSpotlight = useGraphStore(s => s.setEnableLaunchSpotlight)
  const setLaunchSpotlightMode = useGraphStore(s => s.setLaunchSpotlightMode)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const parserLoadMsg = useParserUIState(s => s.parserLoadMsg)
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)
  const [dismissed, setDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false)
  const [step, setStep] = React.useState(0)
  const [ready, setReady] = React.useState(false)
  const [minimized, setMinimized] = React.useState(false)
  const lifecycleStageRef = React.useRef(lifecycleStage)
  React.useEffect(() => {
    const prev = lifecycleStageRef.current
    if ((prev !== 'committed' && lifecycleStage === 'committed') || (prev !== 'reset' && lifecycleStage === 'reset')) {
      setStep(0)
    }
    lifecycleStageRef.current = lifecycleStage
  }, [lifecycleStage])
  React.useEffect(() => {
    if (!enableSpotlight || dismissed) return
    const id = window.setTimeout(() => {
      setReady(true)
    }, 400)
    return () => window.clearTimeout(id)
  }, [enableSpotlight, dismissed])
  React.useEffect(() => {
    if (!enableSpotlight) return
    if (mode !== 'stats') return
    setMinimized(false)
  }, [enableSpotlight, mode])
  const statusSignatureRef = React.useRef<string>('')
  const statusPanelPinned = useGraphStore(s => s.statusPanelPinned)
  React.useEffect(() => {
    const nextSignature = JSON.stringify({
      parserLoadOk,
      parserLoadMsg,
      dataLoadOk,
      dataLoadMsg,
      schemaOpOk,
      schemaOpMsg,
      schemaLintCount,
      graphFieldsOpOk,
      graphFieldsOpMsg,
      orchestratorOpOk,
      orchestratorOpMsg,
      renderOpOk,
      renderOpMsg,
    })
    const prevSignature = statusSignatureRef.current
    statusSignatureRef.current = nextSignature
    if (prevSignature === nextSignature) return
    const hasProblem =
      dataLoadOk === false ||
      parserLoadOk === false ||
      schemaOpOk === false ||
      graphFieldsOpOk === false ||
      orchestratorOpOk === false ||
      renderOpOk === false ||
      (typeof schemaLintCount === 'number' && schemaLintCount > 0)
    if (hasProblem) {
      setLaunchSpotlightMode('stats')
      setEnableLaunchSpotlight(true)
      setDismissed(false)
      setMinimized(false)
      return
    }
    if (statusPanelPinned) return
    if (mode !== 'stats') return
    setEnableLaunchSpotlight(false)
  }, [
    parserLoadOk,
    parserLoadMsg,
    dataLoadOk,
    dataLoadMsg,
    schemaOpOk,
    schemaOpMsg,
    schemaLintCount,
    graphFieldsOpOk,
    graphFieldsOpMsg,
    orchestratorOpOk,
    orchestratorOpMsg,
    renderOpOk,
    renderOpMsg,
    setEnableLaunchSpotlight,
    setLaunchSpotlightMode,
    setDismissed,
    mode,
    statusPanelPinned,
  ])
  React.useEffect(() => {
    if (mode !== 'stats') return
    if (!enableSpotlight || dismissed || !ready) return
  }, [enableSpotlight, dismissed, ready, mode])
  if (!enableSpotlight || dismissed || !ready) return null
  if (mode === 'stats') {
    return (
      <LaunchSpotlightStatusCard
        dismissed={dismissed}
        ready={ready}
        minimized={minimized}
        setMinimized={setMinimized}
      />
    )
  }
  return (
    <LaunchSpotlightTourCard
      dismissed={dismissed}
      setDismissed={setDismissed}
      step={step}
      setStep={setStep}
      ready={ready}
      minimized={minimized}
      setMinimized={setMinimized}
    />
  )
}
