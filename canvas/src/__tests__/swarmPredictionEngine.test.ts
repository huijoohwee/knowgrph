import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SWARM_PREDICTION_COPY_POLICY,
  SWARM_PREDICTION_SCHEMA_VERSION,
  runSwarmPredictionEngine,
} from '@/features/swarm-prediction/swarmPredictionEngine'
import {
  buildSwarmPredictionRegistryDraft,
  runSwarmPredictionWidgetProperties,
} from '@/features/swarm-prediction/swarmPredictionWidget'
import {
  buildCanonicalWidgetRegistryDraft,
  getWidgetRegistryEntryLabel,
} from '@/features/storyboard-widget-manager/registryTemplates'
import {
  FLOW_SWARM_PREDICTION_NODE_LABEL,
  FLOW_SWARM_PREDICTION_NODE_TYPE_ID,
} from '@/lib/config.storyboard-widget'

const scenarioRequest = () => ({
  scenarioTitle: 'Regional demand shock response',
  seedSignals: [
    { label: 'Supply recovery is improving', valence: 0.42, weight: 0.7, sourceRef: 'source:a' },
    { label: 'Consumer demand remains uncertain', valence: -0.28, weight: 0.9, sourceRef: 'source:b' },
    { label: 'Policy support is expanding', valence: 0.34, weight: 0.5, sourceRef: 'source:c' },
  ],
  agents: [
    { label: 'Planner', cohort: 'operations', initialBelief: 0.2, confidence: 0.62, influence: 0.5, riskTolerance: 0.4 },
    { label: 'Risk reviewer', cohort: 'risk', initialBelief: -0.12, confidence: 0.7, influence: 0.42, riskTolerance: 0.22 },
    { label: 'Market scout', cohort: 'market', initialBelief: 0.06, confidence: 0.58, influence: 0.72, riskTolerance: 0.64 },
  ],
  interventions: [
    { tick: 2, label: 'Inventory buffer intervention', effect: 0.18, targetCohort: 'operations' },
    { tick: 4, label: 'Risk tightening intervention', effect: -0.14, targetCohort: 'risk' },
  ],
  ticks: 6,
  randomSeed: 'stable-fixture',
  createdAtIso: '2026-06-04T00:00:00.000Z',
})

export function testSwarmPredictionEngineProducesDeterministicReplayableReport() {
  const first = runSwarmPredictionEngine(scenarioRequest())
  const second = runSwarmPredictionEngine(scenarioRequest())

  if (first.schema_version !== SWARM_PREDICTION_SCHEMA_VERSION) throw new Error('expected swarm prediction schema version')
  if (first.copy_policy !== SWARM_PREDICTION_COPY_POLICY) throw new Error('expected conceptual no-copy policy')
  if (first.eventLogJson !== second.eventLogJson) throw new Error('expected same seed and scenario to replay the same event log')
  if (first.metricsJson !== second.metricsJson) throw new Error('expected same seed and scenario to replay the same metrics')
  if (first.metrics.agentCount !== 3) throw new Error(`expected configured agent count, got ${first.metrics.agentCount}`)
  if (first.metrics.tickCount > 6) throw new Error(`expected simulation to respect tick cap, got ${first.metrics.tickCount}`)
  if (first.events.length !== first.metrics.eventCount) throw new Error('expected metrics event count to match replay log')
  if (new Set(first.events.map(event => event.id)).size !== first.events.length) throw new Error('expected event ids to be unique')
  if (!first.events.some(event => event.kind === 'intervention_applied')) throw new Error('expected interventions in replay log')
  if (!first.output.includes('Latest Events')) throw new Error('expected text report output')
  if (!first.output.includes('| Metric | Value |') || /<table\b|<br\s*\/?>/i.test(first.output)) {
    throw new Error('expected canonical Markdown pipe-table report output without authored table HTML')
  }
  if (!first.imageUrl.startsWith('data:image/svg+xml')) throw new Error('expected chart image data URL')
}

export function testSwarmPredictionEngineBoundsPreventUnboundedRuns() {
  const result = runSwarmPredictionEngine({
    ...scenarioRequest(),
    ticks: 999,
    bounds: { maxTicks: 5, maxAgents: 2, maxSignals: 2, maxInterventions: 1 },
  })
  if (result.metrics.agentCount > 2) throw new Error(`expected maxAgents cap, got ${result.metrics.agentCount}`)
  if (result.seed_signals.length > 2) throw new Error(`expected maxSignals cap, got ${result.seed_signals.length}`)
  if (result.metrics.tickCount > 5) throw new Error(`expected maxTicks cap, got ${result.metrics.tickCount}`)
  if (result.events.filter(event => event.kind === 'intervention_applied').length > 1) {
    throw new Error('expected maxInterventions cap')
  }
}

export function testSwarmPredictionWidgetRegistryExposesRichMediaOutputs() {
  const direct = buildSwarmPredictionRegistryDraft()
  const canonical = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_SWARM_PREDICTION_NODE_TYPE_ID })
  if (!canonical) throw new Error('expected canonical swarm prediction registry draft')
  if (direct.nodeTypeId !== FLOW_SWARM_PREDICTION_NODE_TYPE_ID || canonical.nodeTypeId !== FLOW_SWARM_PREDICTION_NODE_TYPE_ID) {
    throw new Error('expected swarm prediction node type id')
  }
  const label = getWidgetRegistryEntryLabel({ nodeTypeId: FLOW_SWARM_PREDICTION_NODE_TYPE_ID })
  if (label !== FLOW_SWARM_PREDICTION_NODE_LABEL) throw new Error(`expected swarm prediction label, got ${label}`)
  const paths = new Set(canonical.ports.map(port => `${port.direction}:${port.schemaPath}`))
  for (const path of [
    'input:properties.seedSignalsJson',
    'input:properties.agentPopulationJson',
    'output:properties.output',
    'output:properties.imageUrl',
    'output:properties.eventLogJson',
    'output:properties.metricsJson',
  ]) {
    if (!paths.has(path)) throw new Error(`expected registry port ${path}`)
  }

  const properties = runSwarmPredictionWidgetProperties({
    scenarioTitle: 'Widget run',
    seedSignalsJson: JSON.stringify([{ label: 'Positive seed', valence: 0.5, weight: 1 }]),
    ticks: 3,
    randomSeed: 'widget-fixture',
  })
  if (!String(properties.output || '').includes('Prediction score')) throw new Error('expected widget output text')
  if (Object.prototype.hasOwnProperty.call(properties, 'outputSrcDoc')) throw new Error('expected table output to avoid persisted HTML srcdoc')
  if (!String(properties.imageUrl || '').startsWith('data:image/svg+xml')) throw new Error('expected widget chart image')
  if (typeof properties.predictionScore !== 'number' || typeof properties.confidenceScore !== 'number') {
    throw new Error('expected numeric widget scores')
  }
  const structuredProperties = runSwarmPredictionWidgetProperties({
    scenarioTitle: 'Structured widget run',
    seedSignalsJson: [{ label: 'Structured signal', valence: 0.95, weight: 1 }],
    ticks: 2,
    randomSeed: 'structured-widget-fixture',
  })
  if (typeof structuredProperties.predictionScore !== 'number' || structuredProperties.predictionScore < 0.68) {
    throw new Error('expected widget runner to accept structured connected-value seed signals')
  }
}

export function testSwarmPredictionEngineUsesSharedSemanticKeyAndNoCopiedMirofishSurface() {
  const enginePath = resolve(process.cwd(), 'src', 'features', 'swarm-prediction', 'swarmPredictionEngine.ts')
  const text = readFileSync(enginePath, 'utf8')
  if (!text.includes("import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'")) {
    throw new Error('expected swarm prediction engine to reuse shared graph semantic key helper')
  }
  for (const forbidden of ['MiroFish', '666ghj', 'github.com/666ghj/MiroFish']) {
    if (text.includes(forbidden)) throw new Error(`expected engine code to avoid copied external surface token ${forbidden}`)
  }
}

export function testSwarmPredictionWorkflowRunnerUsesSharedConnectedValues() {
  const runnerPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetWorkflowActions.ts')
  const text = readFileSync(runnerPath, 'utf8')
  for (const token of [
    'FLOW_SWARM_PREDICTION_NODE_TYPE_ID',
    "import { runSwarmPredictionWidgetProperties } from '@/features/swarm-prediction/swarmPredictionWidget'",
    "String(node.type || '').trim() === FLOW_SWARM_PREDICTION_NODE_TYPE_ID",
    'resolveStoryboardWidgetWorkflowConnectedValuesInput({',
    "readConnectedProperty('properties.seedSignalsJson', 'seedSignalsJson')",
    "message: 'Ran swarm prediction.'",
  ]) {
    if (!text.includes(token)) throw new Error(`expected workflow runner to include ${token}`)
  }
}
