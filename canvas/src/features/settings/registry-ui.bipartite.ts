import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiBipartiteSettingsRegistry: SettingMeta[] = [
  {
    key: 'bipartite.dataSource',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteDataSource,
    write: v => {
      const raw = String(v || '')
      const next: 'api' | 'fixture' | 'workspace' = raw === 'fixture' ? 'fixture' : raw === 'workspace' ? 'workspace' : 'api'
      s().setBipartiteDataSource(next)
    },
    docKey: 'bipartite.dataSource',
    default: () => 'api',
    options: ['api', 'fixture', 'workspace'],
  },
  {
    key: 'bipartite.pollIntervalSec',
    type: 'number',
    source: 'store',
    read: () => s().bipartitePollIntervalSec,
    write: v => s().setBipartitePollIntervalSec(Number(v)),
    docKey: 'bipartite.pollIntervalSec',
    default: () => 60,
  },
  {
    key: 'bipartite.metric.nodeSize',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteNodeSizeMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none' =
        raw === 'pmf_score' || raw === 'gap_velocity' || raw === 'source_count' || raw === 'none' ? raw : 'gap_score'
      s().setBipartiteNodeSizeMetric(next)
    },
    docKey: 'bipartite.metric.nodeSize',
    default: () => 'gap_score',
    options: ['gap_score', 'pmf_score', 'gap_velocity', 'source_count', 'none'],
  },
  {
    key: 'bipartite.metric.nodeGlow',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteNodeGlowMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'pmf_score' | 'gap_score' | 'none' = raw === 'gap_score' || raw === 'none' ? raw : 'pmf_score'
      s().setBipartiteNodeGlowMetric(next)
    },
    docKey: 'bipartite.metric.nodeGlow',
    default: () => 'pmf_score',
    options: ['pmf_score', 'gap_score', 'none'],
  },
  {
    key: 'bipartite.metric.nodePulse',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteNodePulseMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'gap_velocity' | 'pmf_score' | 'none' = raw === 'pmf_score' || raw === 'none' ? raw : 'gap_velocity'
      s().setBipartiteNodePulseMetric(next)
    },
    docKey: 'bipartite.metric.nodePulse',
    default: () => 'gap_velocity',
    options: ['gap_velocity', 'pmf_score', 'none'],
  },
  {
    key: 'bipartite.metric.nodeBorder',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteNodeBorderMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'source_count' | 'gap_score' | 'none' = raw === 'gap_score' || raw === 'none' ? raw : 'source_count'
      s().setBipartiteNodeBorderMetric(next)
    },
    docKey: 'bipartite.metric.nodeBorder',
    default: () => 'source_count',
    options: ['source_count', 'gap_score', 'none'],
  },
  {
    key: 'bipartite.metric.edgeOpacity',
    type: 'string',
    source: 'store',
    read: () => s().bipartiteEdgeOpacityMetric,
    write: v => {
      const raw = String(v || '')
      const next: 'strength' | 'none' = raw === 'none' ? 'none' : 'strength'
      s().setBipartiteEdgeOpacityMetric(next)
    },
    docKey: 'bipartite.metric.edgeOpacity',
    default: () => 'strength',
    options: ['strength', 'none'],
  },
  {
    key: 'bipartite.show.specificityBadges',
    type: 'boolean',
    source: 'store',
    read: () => s().bipartiteShowSpecificityBadges,
    write: v => s().setBipartiteShowSpecificityBadges(Boolean(v)),
    docKey: 'bipartite.show.specificityBadges',
    default: () => true,
  },
  {
    key: 'bipartite.show.gapScoreInLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().bipartiteShowGapScoreInLabel,
    write: v => s().setBipartiteShowGapScoreInLabel(Boolean(v)),
    docKey: 'bipartite.show.gapScoreInLabel',
    default: () => true,
  },
  {
    key: 'bipartite.show.clusterGapRatio',
    type: 'boolean',
    source: 'store',
    read: () => s().bipartiteShowClusterGapRatio,
    write: v => s().setBipartiteShowClusterGapRatio(Boolean(v)),
    docKey: 'bipartite.show.clusterGapRatio',
    default: () => true,
  },
]
