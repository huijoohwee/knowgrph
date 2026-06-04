import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

export function testGraphRagTextPipelineSectionStageGridUsesResponsiveOwner() {
  const source = readFileSync(resolve(process.cwd(), 'src/features/panels/views/GraphRagTextPipelineSection.tsx'), 'utf8')
  if (!source.includes("GRAPH_RAG_TEXT_PIPELINE_STAGE_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2'") || source.includes('grid md:grid-cols-2 gap-3')) {
    throw new Error('expected GraphRAG text pipeline stage grid to use a mobile-first responsive owner')
  }
}

export function testGraphRagAieBookDemoGridsUseResponsiveOwners() {
  const source = readFileSync(resolve(process.cwd(), 'src/features/demo/GraphRagAieBookChapterSummariesDemo.tsx'), 'utf8')
  for (const snippet of [
    "AIE_BOOK_CHAPTER_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3'",
    "AIE_BOOK_STAGE_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2'",
    "AIE_BOOK_GRAPH_STATS_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-3 text-center sm:grid-cols-3'",
    "AIE_BOOK_INSIGHTS_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-4 text-sm md:grid-cols-2'",
  ]) {
    if (!source.includes(snippet)) throw new Error(`expected AIE demo responsive owner: ${snippet}`)
  }
  for (const stale of ['grid grid-cols-3 gap-3', 'grid md:grid-cols-2 gap-6', 'grid grid-cols-3 gap-3 text-center', 'grid md:grid-cols-2 gap-4 text-sm']) {
    if (source.includes(stale)) throw new Error(`expected AIE demo to avoid stale grid literal: ${stale}`)
  }
}

export function testGraphRagAieBookDemoLayoutUsesResponsiveOwner() {
  const source = readFileSync(resolve(process.cwd(), 'src/features/demo/GraphRagAieBookChapterSummariesDemo.tsx'), 'utf8')
  const css = readFileSync(resolve(process.cwd(), 'src/styles/aie-book-demo-responsive.css'), 'utf8')
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
  if (!source.includes("AIE_BOOK_DEMO_CONTENT_CLASS_NAME = 'kg-aie-book-demo-content'")) {
    throw new Error('expected AIE demo content width to expose a responsive owner')
  }
  if (!source.includes('className={AIE_BOOK_DEMO_CONTENT_CLASS_NAME}')) {
    throw new Error('expected AIE demo content shell to consume the responsive owner')
  }
  if (source.includes('max-w-6xl mx-auto')) {
    throw new Error('expected AIE demo content shell to avoid inline max-width layout literals')
  }
  if (!css.includes('.kg-aie-book-demo-content') || !css.includes('--kg-aie-book-demo-content-width')) {
    throw new Error('expected AIE demo responsive CSS to own the content width')
  }
  if (!indexCss.includes("@import './styles/aie-book-demo-responsive.css';")) {
    throw new Error('expected app CSS to import the AIE demo responsive owner stylesheet')
  }
}
