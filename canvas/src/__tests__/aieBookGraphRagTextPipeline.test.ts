import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { AIE_BOOK_CHAPTER_SNIPPETS } from '@/features/demo/aieBookChapterSnippets'

export function testGraphRagTextPipelineExtractsFromAieBookSnippets() {
  const chapters = Object.values(AIE_BOOK_CHAPTER_SNIPPETS)
  if (chapters.length < 2) throw new Error('Expected at least 2 chapter snippets')

  for (const ch of chapters) {
    const res = runGraphRagTextPipeline(ch.text)
    const graph = res.graphData
    if (graph.type !== 'Graph') throw new Error('Expected GraphData.type=Graph')
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) throw new Error(`Expected nodes for ${ch.title}`)
    if (!Array.isArray(graph.edges) || graph.edges.length === 0) throw new Error(`Expected edges for ${ch.title}`)

    const meta = graph.metadata as unknown as Record<string, unknown>
    const pipeline = meta?.graphragTextPipeline as unknown as Record<string, unknown>
    const stages = pipeline?.stages as unknown
    if (!Array.isArray(stages) || stages.length !== 10) throw new Error(`Expected 10 stages for ${ch.title}`)

    const stageIds = stages.map(s => String((s as Record<string, unknown>).id || ''))
    const expectedOrder = [
      'nltkPreprocess',
      'hfTokenize',
      'spacyNerPos',
      'tripleExtract',
      'extractiveSummarize',
      'entityAnalytics',
      'relationAnalytics',
      'graphConstruct',
      'metadataAnalytics',
      'clusterAnalytics',
    ]
    expectedOrder.forEach((id, idx) => {
      if (stageIds[idx] !== id) throw new Error(`Expected stage ${idx}=${id} for ${ch.title}, got ${stageIds[idx]}`)
    })

    const tripleStage = stages.find(s => String((s as Record<string, unknown>).id || '') === 'tripleExtract') as
      | Record<string, unknown>
      | undefined
    const tripleOut = (tripleStage?.output || {}) as Record<string, unknown>
    const triples = tripleOut.triples
    if (!Array.isArray(triples) || triples.length === 0) throw new Error(`Expected triples for ${ch.title}`)
  }
}
