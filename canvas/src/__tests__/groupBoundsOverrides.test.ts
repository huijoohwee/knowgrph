import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  applySchemaGroupBoundsOverrides,
  readNodeBoundsOverride,
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

export function testGroupBoundsOverridesReuseSharedReaders() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'groupBoundsOverrides.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected group bounds overrides to reuse the shared document metadata reader upstream')
  }
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected group bounds overrides to reuse the shared node properties reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected group bounds overrides to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readGroupBoundsOverride = (raw: unknown): GroupBoundsOverride | null => {')) {
    throw new Error('expected group bounds overrides to centralize bounds parsing in one local helper')
  }
  if (!text.includes('const meta = toMetadataRecord((schema as unknown as { metadata?: unknown })?.metadata)')) {
    throw new Error('expected schema bounds reads to reuse the shared document metadata reader')
  }
  if (!text.includes("const props = readNodeProperties(node as Pick<GraphNode, 'properties'> | null | undefined)")) {
    throw new Error('expected node bounds reads to reuse the shared node properties reader')
  }
  if (text.includes('const isRecord = (v: unknown): v is Record<string, unknown> =>')) {
    throw new Error('expected group bounds overrides to stop defining a local record guard')
  }
}

export function testReadNodeBoundsOverrideUsesSharedNodePropertiesReader() {
  const bounds = readNodeBoundsOverride({
    id: 'n1',
    properties: {
      'visual:boundsOverride': { x: 1, y: 2, width: 30, height: 40, labelX: 5 },
    },
  } as never)
  if (!bounds) throw new Error('expected node bounds override to be read')
  if (bounds.x !== 1 || bounds.y !== 2 || bounds.width !== 30 || bounds.height !== 40) {
    throw new Error('expected node bounds override values to be preserved')
  }
  if (bounds.labelX !== 5) throw new Error('expected node bounds override optional labelX to be preserved')
}

export function testGroupBoundsOverrideStoreReusesSharedNodePropertiesReader() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'groupBoundsOverridesStore.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected group bounds override store to reuse the shared node properties reader upstream')
  }
  if (!text.includes("return readNodeProperties(node as Pick<GraphNode, 'properties'> | null)")) {
    throw new Error('expected group bounds override store to reuse the shared node properties reader for store writes')
  }
  if (text.includes("return props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : {}")) {
    throw new Error('expected group bounds override store to stop coercing node properties inline')
  }
}
