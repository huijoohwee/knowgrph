import type { WidgetRegistryEntry, WidgetRegistryField, WidgetRegistryPort } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  FLOW_SWARM_PREDICTION_FORM_ID,
  FLOW_SWARM_PREDICTION_NODE_LABEL,
  FLOW_SWARM_PREDICTION_NODE_TYPE_ID,
  FLOW_SWARM_PREDICTION_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { runSwarmPredictionEngine } from '@/features/swarm-prediction/swarmPredictionEngine'

const readString = (value: unknown): string => String(value || '').trim()

const readJsonString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (value === null || typeof value === 'undefined') return ''
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value || '').trim()
}

const readNumber = (value: unknown, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const SWARM_PREDICTION_FIELDS: WidgetRegistryField[] = [
  { fieldKey: 'scenarioTitle', fieldType: 'text', schemaPath: 'properties.scenarioTitle', required: true, label: 'Scenario' },
  { fieldKey: 'seedSignalsJson', fieldType: 'textarea', schemaPath: 'properties.seedSignalsJson', required: true, label: 'Seed signals JSON' },
  { fieldKey: 'agentPopulationJson', fieldType: 'textarea', schemaPath: 'properties.agentPopulationJson', label: 'Agent population JSON' },
  { fieldKey: 'interventionsJson', fieldType: 'textarea', schemaPath: 'properties.interventionsJson', label: 'Interventions JSON' },
  { fieldKey: 'ticks', fieldType: 'number', schemaPath: 'properties.ticks', label: 'Ticks' },
  { fieldKey: 'randomSeed', fieldType: 'text', schemaPath: 'properties.randomSeed', label: 'Seed' },
  { fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Output' },
  { fieldKey: 'imageUrl', fieldType: 'text', schemaPath: 'properties.imageUrl', label: 'Chart image URL' },
  { fieldKey: 'predictionScore', fieldType: 'number', schemaPath: 'properties.predictionScore', label: 'Prediction score' },
  { fieldKey: 'confidenceScore', fieldType: 'number', schemaPath: 'properties.confidenceScore', label: 'Confidence score' },
  { fieldKey: 'eventLogJson', fieldType: 'textarea', schemaPath: 'properties.eventLogJson', label: 'Event log JSON' },
  { fieldKey: 'metricsJson', fieldType: 'textarea', schemaPath: 'properties.metricsJson', label: 'Metrics JSON' },
]

const SWARM_PREDICTION_PORTS: WidgetRegistryPort[] = [
  { portKey: 'seedSignalsJson_in', direction: 'input', schemaPath: 'properties.seedSignalsJson' },
  { portKey: 'agentPopulationJson_in', direction: 'input', schemaPath: 'properties.agentPopulationJson' },
  { portKey: 'interventionsJson_in', direction: 'input', schemaPath: 'properties.interventionsJson' },
  { portKey: 'scenarioTitle_in', direction: 'input', schemaPath: 'properties.scenarioTitle' },
  { portKey: 'output', direction: 'output', schemaPath: 'properties.output' },
  { portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' },
  { portKey: 'predictionScore', direction: 'output', schemaPath: 'properties.predictionScore' },
  { portKey: 'confidenceScore', direction: 'output', schemaPath: 'properties.confidenceScore' },
  { portKey: 'eventLogJson', direction: 'output', schemaPath: 'properties.eventLogJson' },
  { portKey: 'metricsJson', direction: 'output', schemaPath: 'properties.metricsJson' },
]

export function buildSwarmPredictionRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_SWARM_PREDICTION_NODE_TYPE_ID,
    widgetTypeId: FLOW_SWARM_PREDICTION_WIDGET_TYPE_ID,
    formId: FLOW_SWARM_PREDICTION_FORM_ID,
    fields: SWARM_PREDICTION_FIELDS,
    ports: SWARM_PREDICTION_PORTS,
    schemaMappings: [],
  }
}

export function runSwarmPredictionWidgetProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result = runSwarmPredictionEngine({
    scenarioTitle: readString(properties.scenarioTitle),
    seedSignalsJson: readJsonString(properties.seedSignalsJson),
    agentPopulationJson: readJsonString(properties.agentPopulationJson),
    interventionsJson: readJsonString(properties.interventionsJson),
    ticks: readNumber(properties.ticks, 12),
    randomSeed: readString(properties.randomSeed),
  })
  return {
    ...properties,
    output: result.output,
    imageUrl: result.imageUrl,
    predictionScore: result.prediction.score,
    confidenceScore: result.prediction.confidence,
    eventLogJson: result.eventLogJson,
    metricsJson: result.metricsJson,
    swarmPredictionRunId: result.run_id,
  }
}
