import { AgenticRagPipeline, DEFAULT_AGENTIC_RAG_CONFIG } from '../features/agentic-rag'

export function testAgenticRagPipelineEndToEnd() {
  console.log('Starting AgenticRagPipeline End-to-End Test...')

  // 1. Initialize Pipeline with auto-tune enabled
  const pipeline = new AgenticRagPipeline({
    ...DEFAULT_AGENTIC_RAG_CONFIG,
    auto_tune_enabled: true,
    feedback_window_size: 2
  })

  // 2. Prepare Mock Documents
  // Doc 1: Simple, high confidence
  const doc1 = `
    Apple releases new iPhone. 
    The device features a better camera. 
    Customers wait in line.
  `

  // Doc 2: Complex, duplicate entities
  const doc2 = `
    Apple announces quarterly earnings.
    The iPhone sales caused a revenue spike.
    Investors are happy because dividends increased.
    This leads to stock growth.
  `

  // 3. Run Pipeline
  const result = pipeline.run([doc1, doc2])

  // 4. Verify Output
  
  // Entities should include Apple, iPhone, Investors, etc.
  const entityNames = result.entities.map(e => e.text.toLowerCase())
  if (!entityNames.some(n => n.includes('apple'))) throw new Error('Entity Apple not found')
  if (!entityNames.some(n => n.includes('iphone'))) throw new Error('Entity iPhone not found')
  
  // Edges should exist (e.g. iPhone -> revenue, Apple -> iPhone)
  if (result.edges.length === 0) throw new Error('No edges extracted')
  
  console.log(`Extracted ${result.entities.length} entities and ${result.edges.length} edges.`)
  console.log('Entities:', result.entities.map(e => e.text))

  // 5. Verify Unification
  // "Apple" should appear once (unified), not twice
  const appleCount = result.entities.filter(e => e.text.toLowerCase() === 'apple').length
  if (appleCount > 1) throw new Error('Duplicate entities found (Unification failed)')
  
  // 6. Verify Corpus Reasoning (PageRank)
  // Check if centrality scores are present
  const hasCentrality = result.entities.some(e => e.properties?.centrality !== undefined)
  if (!hasCentrality) throw new Error('Centrality scores missing (CorpusReasoner failed)')

  // 7. Test Query Engine
  const engine = pipeline.createQueryEngine(result)
  const query = "What does Apple do?"
  const answer = engine.query(query)
  
  console.log(`Query: "${query}"`)
  console.log(`Answer: ${answer}`)
  
  if (!answer.includes('Apple')) throw new Error('Query answer irrelevant')
  
  console.log('AgenticRagPipeline End-to-End Test Passed!')
}
