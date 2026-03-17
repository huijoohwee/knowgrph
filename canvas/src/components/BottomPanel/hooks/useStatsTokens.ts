import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { getStatsTokenizationConfig } from '@/components/BottomPanel/BottomPanelStatsUtils'

type UseStatsTokensProps = {
  schema: GraphSchema
}

export function useStatsTokens({ schema }: UseStatsTokensProps) {
  const [statsExcludeTokens, setStatsExcludeTokens] = React.useState<string[]>([])
  const [statsIncludeTokens, setStatsIncludeTokens] = React.useState<string[]>([])
  const [statsFilterMode, setStatsFilterMode] = React.useState<'exclude' | 'include'>('include')

  const baseTokenCfg = React.useMemo(
    () => getStatsTokenizationConfig(schema),
    [schema],
  )

  const tokenCfg = React.useMemo(() => {
    const base = baseTokenCfg
    const extra = new Set(base.stopwords)
    for (let i = 0; i < statsExcludeTokens.length; i += 1) {
      const t = statsExcludeTokens[i]
      const v = String(t || '').toLowerCase()
      if (!v) continue
      extra.add(v)
    }
    const includeTokens: string[] = []
    for (let i = 0; i < statsIncludeTokens.length; i += 1) {
      const t = statsIncludeTokens[i]
      const v = String(t || '').toLowerCase()
      if (!v) continue
      extra.delete(v)
      includeTokens.push(v)
    }
    const includeSet =
      statsFilterMode === 'include' && includeTokens.length > 0 ? new Set<string>(includeTokens) : null
    return {
      textKeys: base.textKeys,
      minTokenLength: base.minTokenLength,
      maxTokensPerNode: base.maxTokensPerNode,
      stopwords: extra as ReadonlySet<string>,
      includeTokens: includeSet,
    }
  }, [baseTokenCfg, statsExcludeTokens, statsFilterMode, statsIncludeTokens])

  const toggleStatsStopword = React.useCallback((token: string) => {
    const t = String(token || '').toLowerCase()
    if (!t) return
    if (statsFilterMode === 'include') {
      setStatsIncludeTokens(prev => {
        const exists = prev.includes(t)
        if (exists) return prev.filter(x => x !== t)
        return [...prev, t]
      })
      setStatsExcludeTokens(prev => prev.filter(x => x !== t))
      return
    }
    setStatsExcludeTokens(prev => {
      const exists = prev.includes(t)
      if (exists) return prev.filter(x => x !== t)
      return [...prev, t]
    })
    setStatsIncludeTokens(prev => prev.filter(x => x !== t))
  }, [statsFilterMode])

  return {
    baseTokenCfg,
    tokenCfg,
    statsExcludeTokens,
    setStatsExcludeTokens,
    statsIncludeTokens,
    setStatsIncludeTokens,
    statsFilterMode,
    setStatsFilterMode,
    toggleStatsStopword,
  }
}
