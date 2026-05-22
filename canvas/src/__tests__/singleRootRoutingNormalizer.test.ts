import { normalizeSingleRootRoute } from '@/lib/routing/normalizeSingleRoot'

export function testNormalizeSingleRootRouteNoopsOnRoot() {
  const out = normalizeSingleRootRoute({ pathname: '/', search: '?a=1', hash: '#x' })
  if (out !== null) throw new Error('expected null for root pathname')
}

export function testNormalizeSingleRootRouteStashesPathAndPreservesSearchAndHash() {
  const out = normalizeSingleRootRoute({ pathname: '/doc/123', search: '?a=1', hash: '#h' })
  if (!out) throw new Error('expected normalization result')
  if (out.pathname !== '/') throw new Error(`expected pathname '/'; got ${out.pathname}`)
  if (!out.search.includes('a=1')) throw new Error(`expected search to preserve existing params; got ${out.search}`)
  if (!out.search.includes('kgPath=%2Fdoc%2F123')) throw new Error(`expected kgPath to be set; got ${out.search}`)
  if (out.hash !== '#h') throw new Error(`expected hash to be preserved; got ${out.hash}`)
}

export function testNormalizeSingleRootRouteDoesNotOverrideExistingKgPath() {
  const out = normalizeSingleRootRoute({ pathname: '/x', search: '?kgPath=%2Fkeep&b=2', hash: '' })
  if (!out) throw new Error('expected normalization result')
  if (!out.search.includes('kgPath=%2Fkeep')) throw new Error(`expected kgPath to be preserved; got ${out.search}`)
  if (out.search.includes('kgPath=%2Fx')) throw new Error(`expected kgPath not to be overridden; got ${out.search}`)
}

export function testNormalizeSingleRootRoutePromotesOpaqueSharePath() {
  const out = normalizeSingleRootRoute({ pathname: '/share/opaque-token', search: '?a=1', hash: '' })
  if (!out) throw new Error('expected normalization result')
  if (out.pathname !== '/') throw new Error(`expected pathname '/'; got ${out.pathname}`)
  if (!out.search.includes('a=1')) throw new Error(`expected search to preserve existing params; got ${out.search}`)
  if (!out.search.includes('kgShare=opaque-token')) throw new Error(`expected kgShare to be set from share path; got ${out.search}`)
  if (out.search.includes('kgPath=')) throw new Error(`expected share path not to be downgraded into kgPath; got ${out.search}`)
}
