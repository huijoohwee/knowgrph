import { reorderList } from '@/lib/reorder'

export function testReorderListBasicMoves() {
  const src = ['a', 'b', 'c']
  const up = reorderList(src, 2, 0)
  if (up.length !== 3 || up[0] !== 'c' || up[1] !== 'a' || up[2] !== 'b') {
    throw new Error('expected element moved up to index 0')
  }
  const down = reorderList(src, 0, 2)
  if (down.length !== 3 || down[0] !== 'b' || down[1] !== 'c' || down[2] !== 'a') {
    throw new Error('expected element moved down to last index')
  }
}

export function testReorderListNoopAndBounds() {
  const src = ['a', 'b', 'c']
  const same = reorderList(src, 1, 1)
  if (same !== src) {
    throw new Error('expected noop move to return original array')
  }
  const outOfRangeLow = reorderList(src, -1, 1)
  if (outOfRangeLow !== src) {
    throw new Error('expected out-of-range fromIndex to return original array')
  }
  const outOfRangeHigh = reorderList(src, 0, 10)
  if (outOfRangeHigh !== src) {
    throw new Error('expected out-of-range toIndex to return original array')
  }
}

