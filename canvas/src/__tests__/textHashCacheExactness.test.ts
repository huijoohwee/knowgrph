import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import { hashStringToHex } from '@/lib/hash/stringHash'

export function testTextHashCacheRejectsSampleSignatureStaleness() {
  const key = 'text-hash-cache:exactness'
  const head = 'a'.repeat(640)
  const midGap = 'b'.repeat(512)
  const mid = 'm'.repeat(320)
  const tail = 'z'.repeat(640)
  const textA = `${head}first-body${midGap}${mid}${tail}`
  const textB = `${head}secondbody${midGap}${mid}${tail}`

  if (textA.length !== textB.length) {
    throw new Error('test fixture must keep equal-length texts to exercise stale sampled-signature regressions')
  }

  const cachedA = hashStringToHexCached(key, textA)
  const cachedB = hashStringToHexCached(key, textB)
  const expectedB = hashStringToHex(textB)

  if (cachedB !== expectedB) {
    throw new Error('expected text hash cache to recompute changed same-key text exactly instead of reusing a sampled stale hash')
  }
  if (cachedA === cachedB) {
    throw new Error('expected changed same-key text to produce a distinct cached hash')
  }
}
