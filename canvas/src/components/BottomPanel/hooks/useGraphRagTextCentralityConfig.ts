import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import {
  DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG,
  type GraphRagTextCentralityConfig,
  parseGraphRagTextCentralityConfig,
} from '@/lib/graph/graphragTextConfig'

export const useGraphRagTextCentralityConfig = () => {
  const [cfg, setCfg] = React.useState<GraphRagTextCentralityConfig>(() =>
    lsJson(LS_KEYS.graphragTextCentralityConfig, DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG, parseGraphRagTextCentralityConfig),
  )

  React.useEffect(() => {
    lsSetJson(LS_KEYS.graphragTextCentralityConfig, cfg)
  }, [cfg])

  const update = React.useCallback((patch: Partial<GraphRagTextCentralityConfig>) => {
    setCfg(prev => ({ ...prev, ...patch }))
  }, [])

  const reset = React.useCallback(() => {
    setCfg(DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG)
  }, [])

  return { cfg, update, reset }
}

