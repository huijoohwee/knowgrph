import { hashStringToHex, hashStringToIndex } from '@/lib/hash/stringHash'
import { hashStringToIndex as gympgrphHashStringToIndex } from 'gympgrph'

export function testHashStringContractIsSharedAcrossRepos() {
  const inputs = ['', 'abc', 'Hello world', '🚀 unicode', 'a'.repeat(1000)]
  for (const input of inputs) {
    const hex = hashStringToHex(input)
    if (typeof hex !== 'string' || hex.length !== 8) {
      throw new Error(`Expected 8-char hex hash, got ${String(hex)}`)
    }
    const idxA = hashStringToIndex(input, 97)
    const idxB = gympgrphHashStringToIndex(input, 97)
    if (idxA !== idxB) {
      throw new Error(`Expected shared hashStringToIndex, got ${idxA} vs ${idxB}`)
    }
  }
}
