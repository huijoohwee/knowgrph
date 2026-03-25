import { findIndexById, patchAtIndex, patchById, replaceAtIndex } from 'grph-shared/array/patchArrayItem'

export function testPatchArrayHelpersBehaveAndAvoidUnnecessaryCopies() {
  const base = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]

  const same = replaceAtIndex(base, 1, base[1]!)
  if (same !== base) throw new Error('expected replaceAtIndex to return same array when item is identical')

  const updated = replaceAtIndex(base, 1, { id: 'b', v: 3 })
  if (updated === base) throw new Error('expected replaceAtIndex to return new array when item changes')
  if ((updated as any)[1].v !== 3) throw new Error('expected replaceAtIndex to update target slot')

  const idx = findIndexById(base, 'b', x => x.id)
  if (idx !== 1) throw new Error('expected findIndexById to locate matching id')

  const patched = patchAtIndex(base, 0, cur => ({ ...cur, v: 9 }))
  if ((patched as any)[0].v !== 9) throw new Error('expected patchAtIndex to update target slot')

  const patchedById = patchById(base, 'a', x => x.id, cur => ({ ...cur, v: 7 }), 0)
  if ((patchedById as any)[0].v !== 7) throw new Error('expected patchById to patch by id')
}

