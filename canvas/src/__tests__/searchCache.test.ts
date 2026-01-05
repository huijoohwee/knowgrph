import { computeSearchResults } from '@/features/toolbar/utils'

const mkData = (ids: string[]) => ({
  nodes: ids.map(id => ({ id, label: id, type: 't', properties: {} })),
  edges: [],
})

export function testSearchCacheKeysRespectVersion() {
  const dataA = mkData(['a1','a2'])
  const dataB = mkData(['b1','b2'])
  const q = 'a'
  const resA1 = computeSearchResults(dataA, q, 50, 'G|0')
  const resA2 = computeSearchResults(dataA, q, 50, 'G|0')
  if (resA1 !== resA2) throw new Error('Cache did not hit for same versionKey')
  const resB = computeSearchResults(dataB, q, 50, 'G|1')
  // If cache keys ignore version, resB could equal resA1 by stale hit; ensure difference
  const jsonA = JSON.stringify(resA1)
  const jsonB = JSON.stringify(resB)
  if (jsonA === jsonB) throw new Error('Cache key ignored version and returned stale results')
}

