import { parseJsonLd } from '@/lib/graph/jsonld'

export function testJsonLdInferredEdgesFromCompactIriArrays() {
  const jsonld = {
    '@context': {
      '@vocab': 'https://huijoohwee.github.io/schema/AgenticRAG/v1/',
      aiap: 'https://huijoohwee.github.io/aiap22/pipeline/',
      rag: 'https://huijoohwee.github.io/schema/AgenticRAG/v1/',
    },
    '@graph': [
      {
        '@id': 'aiap:A',
        '@type': 'rag:PipelinePhase',
        phase_name: 'A',
        steps: ['aiap:B', 'aiap:Missing'],
      },
      {
        '@id': 'aiap:B',
        '@type': 'rag:RoleActionOutcome',
        step_id: 'B',
      },
    ],
  }

  const g = parseJsonLd(jsonld)
  if (g.nodes.length !== 2) throw new Error('jsonld inferred edges nodes mismatch')
  if (g.edges.length !== 1) throw new Error('jsonld inferred edges count mismatch')
  const e = g.edges[0]
  if (e.label !== 'steps') throw new Error('jsonld inferred edges label mismatch')
  if (String(e.source) !== 'aiap:A' || String(e.target) !== 'aiap:B') {
    throw new Error('jsonld inferred edges endpoints mismatch')
  }
  const phase = g.nodes.find(n => String(n.id) === 'aiap:A')
  if (!phase) throw new Error('jsonld inferred edges phase node missing')
  const steps = phase.properties.steps as unknown
  if (!Array.isArray(steps)) throw new Error('jsonld inferred edges phase steps property missing')
  if (!steps.includes('aiap:B')) throw new Error('jsonld inferred edges phase steps missing aiap:B')
}

export function testJsonLdPhaseMembershipArraysWithKgPrefix() {
  const jsonld = {
    '@context': {
      kg: 'http://example.org/kg#',
    },
    '@graph': [
      {
        '@id': 'kg:phase1',
        '@type': 'PipelinePhase',
        label: 'Phase 1',
        steps: ['kg:step-a', 'kg:step-b'],
      },
      {
        '@id': 'kg:step-a',
        '@type': 'Step',
        label: 'Step A',
      },
      {
        '@id': 'kg:step-b',
        '@type': 'Step',
        label: 'Step B',
      },
    ],
  }

  const g = parseJsonLd(jsonld)
  if (g.nodes.length !== 3) throw new Error('jsonld kg prefix nodes mismatch')
  const phase = g.nodes.find(n => String(n.id) === 'phase1')
  if (!phase) throw new Error('jsonld kg prefix phase node id mismatch')
  const steps = phase.properties.steps as unknown
  if (!Array.isArray(steps)) throw new Error('jsonld kg prefix phase steps property missing')
  if (!steps.includes('kg:step-a') || !steps.includes('kg:step-b')) {
    throw new Error('jsonld kg prefix phase steps missing expected ids')
  }
}
