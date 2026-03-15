import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  applySchemaGroupBoundsOverrides,
  readSchemaGroupBoundsOverrides,
  withSchemaGroupBoundsOverride,
  withoutSchemaGroupBoundsOverride,
} from '@/lib/canvas/groupBoundsOverrides'

export function testGroupBoundsOverridesReadWrite() {
  const base: GraphSchema = { behavior: { allowEdgeCreation: true, allowNodeDrag: true } } as unknown as GraphSchema
  const withOne = withSchemaGroupBoundsOverride(base, 'g1', { x: 1, y: 2, width: 30, height: 40 })
  const read1 = readSchemaGroupBoundsOverrides(withOne)
  if (!read1.g1) throw new Error('expected schema override for g1')
  if (read1.g1.x !== 1 || read1.g1.y !== 2 || read1.g1.width !== 30 || read1.g1.height !== 40) throw new Error('unexpected override values')

  const cleared = withoutSchemaGroupBoundsOverride(withOne, 'g1')
  const read2 = readSchemaGroupBoundsOverrides(cleared)
  if (read2.g1) throw new Error('expected override to be removed')
}

export function testGroupBoundsOverridesApplyDoesNotOverwriteExistingBounds() {
  const groups: GraphGroup[] = [
    { id: 'g1', label: 'A', depth: 0, memberNodeIds: ['n1'], style: {} },
    { id: 'g2', label: 'B', depth: 0, memberNodeIds: ['n2'], style: {}, bounds: { x: 9, y: 9, width: 9, height: 9 } },
  ]
  const applied = applySchemaGroupBoundsOverrides(groups, {
    g1: { x: 1, y: 2, width: 30, height: 40 },
    g2: { x: 1, y: 2, width: 30, height: 40 },
  })
  const g1 = applied.find(g => g.id === 'g1')
  const g2 = applied.find(g => g.id === 'g2')
  if (!g1?.bounds) throw new Error('expected g1 bounds to be applied')
  if (g1.bounds.x !== 1 || g1.bounds.y !== 2) throw new Error('expected g1 override values')
  if (!g2?.bounds) throw new Error('expected g2 bounds to exist')
  if (g2.bounds.x !== 9 || g2.bounds.y !== 9) throw new Error('expected g2 existing bounds to remain')
}
