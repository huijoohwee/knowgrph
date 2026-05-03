import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiFlowchartSettingsRegistry: SettingMeta[] = [
  {
    key: 'flowchart.dataSource',
    type: 'string',
    source: 'store',
    read: () => s().flowchartDataSource,
    write: v => {
      const raw = String(v || '')
      const next: 'api' | 'fixture' | 'workspace' = raw === 'fixture' ? 'fixture' : raw === 'workspace' ? 'workspace' : 'api'
      s().setFlowchartDataSource(next)
    },
    docKey: 'flowchart.dataSource',
    default: () => 'api',
    options: ['api', 'fixture', 'workspace'],
  },
  {
    key: 'flowchart.pollIntervalSec',
    type: 'number',
    source: 'store',
    read: () => s().flowchartPollIntervalSec,
    write: v => s().setFlowchartPollIntervalSec(Number(v)),
    docKey: 'flowchart.pollIntervalSec',
    default: () => 60,
  },
  {
    key: 'flowchart.metric.nodeSize',
    type: 'string',
    source: 'store',
    read: () => s().flowchartNodeSizeMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none' =
        raw === 'pmf_score' || raw === 'gap_velocity' || raw === 'source_count' || raw === 'none' ? raw : 'gap_score'
      s().setFlowchartNodeSizeMetric(next)
    },
    docKey: 'flowchart.metric.nodeSize',
    default: () => 'gap_score',
    options: ['gap_score', 'pmf_score', 'gap_velocity', 'source_count', 'none'],
  },
  {
    key: 'flowchart.metric.nodeGlow',
    type: 'string',
    source: 'store',
    read: () => s().flowchartNodeGlowMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'pmf_score' | 'gap_score' | 'none' = raw === 'gap_score' || raw === 'none' ? raw : 'pmf_score'
      s().setFlowchartNodeGlowMetric(next)
    },
    docKey: 'flowchart.metric.nodeGlow',
    default: () => 'pmf_score',
    options: ['pmf_score', 'gap_score', 'none'],
  },
  {
    key: 'flowchart.metric.nodePulse',
    type: 'string',
    source: 'store',
    read: () => s().flowchartNodePulseMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'gap_velocity' | 'pmf_score' | 'none' = raw === 'pmf_score' || raw === 'none' ? raw : 'gap_velocity'
      s().setFlowchartNodePulseMetric(next)
    },
    docKey: 'flowchart.metric.nodePulse',
    default: () => 'gap_velocity',
    options: ['gap_velocity', 'pmf_score', 'none'],
  },
  {
    key: 'flowchart.metric.nodeBorder',
    type: 'string',
    source: 'store',
    read: () => s().flowchartNodeBorderMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'source_count' | 'gap_score' | 'none' = raw === 'gap_score' || raw === 'none' ? raw : 'source_count'
      s().setFlowchartNodeBorderMetric(next)
    },
    docKey: 'flowchart.metric.nodeBorder',
    default: () => 'source_count',
    options: ['source_count', 'gap_score', 'none'],
  },
  {
    key: 'flowchart.metric.edgeOpacity',
    type: 'string',
    source: 'store',
    read: () => s().flowchartEdgeOpacityMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'strength' | 'none' = raw === 'none' ? 'none' : 'strength'
      s().setFlowchartEdgeOpacityMetric(next)
    },
    docKey: 'flowchart.metric.edgeOpacity',
    default: () => 'strength',
    options: ['strength', 'none'],
  },
  {
    key: 'flowchart.show.specificityBadges',
    type: 'boolean',
    source: 'store',
    read: () => s().flowchartShowSpecificityBadges,
    write: v => s().setFlowchartShowSpecificityBadges(Boolean(v)),
    docKey: 'flowchart.show.specificityBadges',
    default: () => true,
  },
  {
    key: 'flowchart.show.gapScoreInLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().flowchartShowGapScoreInLabel,
    write: v => s().setFlowchartShowGapScoreInLabel(Boolean(v)),
    docKey: 'flowchart.show.gapScoreInLabel',
    default: () => true,
  },
  {
    key: 'flowchart.show.clusterGapRatio',
    type: 'boolean',
    source: 'store',
    read: () => s().flowchartShowClusterGapRatio,
    write: v => s().setFlowchartShowClusterGapRatio(Boolean(v)),
    docKey: 'flowchart.show.clusterGapRatio',
    default: () => true,
  },
]
