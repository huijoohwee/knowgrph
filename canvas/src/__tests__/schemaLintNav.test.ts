import { parseSchemaLintOwner } from '@/features/schema/validation'
import { useGraphStore } from '@/hooks/useGraphStore'

export const testParseSchemaLintOwner = () => {
  const a = parseSchemaLintOwner('node.Entity.metadata')
  if (!a || a.ownerKind !== 'node' || a.ownerKey !== 'Entity') {
    throw new Error('parseSchemaLintOwner node path failed')
  }
  const b = parseSchemaLintOwner('edge.RelatedTo.metadata')
  if (!b || b.ownerKind !== 'edge' || b.ownerKey !== 'RelatedTo') {
    throw new Error('parseSchemaLintOwner edge path failed')
  }
  const c = parseSchemaLintOwner('invalidPath')
  if (c !== null) {
    throw new Error('parseSchemaLintOwner should return null for invalid path')
  }
}

export const testSchemaLintSummaryAndActivePath = () => {
  const { setSchemaLintSummary, setSchemaLintActivePath } = useGraphStore.getState()
  setSchemaLintSummary(3, 'node.Entity.metadata', [
    'node.Entity.metadata',
    'edge.RelatedTo.metadata',
    'node.Project.metadata',
  ])
  const state1 = useGraphStore.getState()
  if (state1.schemaLintCount !== 3) {
    throw new Error('schemaLintCount not set correctly')
  }
  if (state1.schemaLintExamplePath !== 'node.Entity.metadata') {
    throw new Error('schemaLintExamplePath not set correctly')
  }
  if (
    !state1.schemaLintExamplePaths ||
    state1.schemaLintExamplePaths.length !== 3 ||
    !state1.schemaLintExamplePaths.includes('edge.RelatedTo.metadata')
  ) {
    throw new Error('schemaLintExamplePaths not set correctly')
  }
  setSchemaLintActivePath('edge.RelatedTo.metadata')
  const state2 = useGraphStore.getState()
  if (state2.schemaLintExamplePath !== 'edge.RelatedTo.metadata') {
    throw new Error('setSchemaLintActivePath did not update active path')
  }
}

