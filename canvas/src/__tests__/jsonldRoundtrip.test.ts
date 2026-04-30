import type { GraphData } from '@/lib/graph/types'
import { parseJsonLd, toJsonLd } from '@/lib/graph/jsonld'
import { parseGraph } from '@/lib/graph/io/adapter'

export function testJsonLdRoundTrip() {
  const g: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'Company', properties: { size: 'L' }, x: 1, y: 2 },
      { id: 'n2', label: 'B', type: 'Investor', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'InvestedIn', properties: { weight: 2 } },
      { id: 'e2', source: 'n1', target: 'n2', label: 'PartnersWith', properties: {} },
    ],
  }
  const jsonld = toJsonLd(g)
  const g2 = parseJsonLd(jsonld)
  if (g2.nodes.length !== 2 || g2.edges.length !== 2) throw new Error('jsonld counts mismatch')
  const e = g2.edges.find(x => x.id.includes('InvestedIn'))
  if (!e) throw new Error('missing reified edge')
  const simple = g2.edges.find(x => x.label === 'PartnersWith')
  if (!simple) throw new Error('missing simple edge')
}

export function testJsonLdAiVizEdges() {
  const jsonld = {
    '@context': {
      '@vocab': 'https://schema.org/',
      concept: 'air:Concept',
      enables: { '@id': 'air:enables', '@type': '@id' },
    },
    '@graph': [
      {
        '@id': 'air:A',
        '@type': 'concept',
        name: 'A',
        enables: ['air:B'],
      },
      {
        '@id': 'air:B',
        '@type': 'concept',
        name: 'B',
      },
    ],
  };
  const g = parseJsonLd(jsonld);
  if (g.nodes.length !== 2) throw new Error('ai viz jsonld nodes mismatch');
  if (g.edges.length !== 1) throw new Error('ai viz jsonld edges mismatch');
  const e = g.edges[0];
  if (e.label !== 'enables') throw new Error('ai viz jsonld edge label mismatch');
  if (String(e.source) !== 'air:A' || String(e.target) !== 'air:B') throw new Error('ai viz jsonld edge endpoints mismatch');
}

const buildSyntheticAgenticGraphJsonLd = () => {
  return {
    '@context': {
      '@vocab': 'https://schema.org/',
      concept: 'air:Concept',
      technique: 'air:Technique',
      component: 'air:Component',
      challenge: 'air:Challenge',
      enables: { '@id': 'air:enables', '@type': '@id' },
      requires: { '@id': 'air:requires', '@type': '@id' },
      includes: { '@id': 'air:includes', '@type': '@id' },
      uses: { '@id': 'air:uses', '@type': '@id' },
      generated_by: { '@id': 'air:generated_by', '@type': '@id' },
      extends_to: { '@id': 'air:extends_to', '@type': '@id' },
      alternative_to: { '@id': 'air:alternative_to', '@type': '@id' },
      implements: { '@id': 'air:implements', '@type': '@id' },
      adapts: { '@id': 'air:adapts', '@type': '@id' },
      enhances: { '@id': 'air:enhances', '@type': '@id' },
      optimizes: { '@id': 'air:optimizes', '@type': '@id' },
      collects: { '@id': 'air:collects', '@type': '@id' },
      feeds: { '@id': 'air:feeds', '@type': '@id' },
      powered_by: { '@id': 'air:powered_by', '@type': '@id' },
      evaluates: { '@id': 'air:evaluates', '@type': '@id' },
    },
    '@graph': [
      {
        '@id': 'air:FoundationModels',
        '@type': 'concept',
        name: 'Foundation Models',
        enables: ['air:AIEngineering'],
        uses: ['air:TransformerArchitecture'],
      },
      {
        '@id': 'air:AIEngineering',
        '@type': 'concept',
        name: 'AI Engineering',
        requires: ['air:Evaluation'],
        includes: ['air:PromptEngineering'],
      },
      {
        '@id': 'air:TransformerArchitecture',
        '@type': 'component',
        name: 'Transformer',
      },
      {
        '@id': 'air:Evaluation',
        '@type': 'concept',
        name: 'Evaluation',
        uses: ['air:AIJudge'],
        evaluates: ['air:RAG', 'air:Finetuning'],
      },
      {
        '@id': 'air:PromptEngineering',
        '@type': 'technique',
        name: 'Prompt Engineering',
        enables: [{ '@id': 'air:RAG', weight: 8 }],
        includes: ['air:Finetuning'],
        alternative_to: ['air:Finetuning'],
      },
      {
        '@id': 'air:RAG',
        '@type': 'technique',
        name: 'RAG',
        requires: ['air:Retriever'],
        extends_to: ['air:AgenticSystems'],
      },
      {
        '@id': 'air:Retriever',
        '@type': 'component',
        name: 'Retriever',
        uses: ['air:VectorSearch'],
      },
      {
        '@id': 'air:VectorSearch',
        '@type': 'technique',
        name: 'Vector Search',
        requires: ['air:Embeddings'],
      },
      {
        '@id': 'air:Embeddings',
        '@type': 'component',
        name: 'Embeddings',
        generated_by: 'air:FoundationModels',
      },
      {
        '@id': 'air:AgenticSystems',
        '@type': 'concept',
        name: 'Agentic Systems',
        requires: ['air:MemorySystem'],
        enables: ['air:MultiHopReasoning'],
      },
      {
        '@id': 'air:Finetuning',
        '@type': 'technique',
        name: 'Finetuning',
        requires: ['air:DatasetEngineering'],
        includes: ['air:PEFT'],
      },
      {
        '@id': 'air:PEFT',
        '@type': 'technique',
        name: 'PEFT',
        implements: ['air:LoRA'],
      },
      {
        '@id': 'air:LoRA',
        '@type': 'technique',
        name: 'LoRA',
        adapts: ['air:FoundationModels'],
      },
      {
        '@id': 'air:DatasetEngineering',
        '@type': 'concept',
        name: 'Dataset Engineering',
      },
      {
        '@id': 'air:MemorySystem',
        '@type': 'component',
        name: 'Memory System',
        uses: ['air:VectorSearch'],
      },
      {
        '@id': 'air:MultiHopReasoning',
        '@type': 'technique',
        name: 'Multi-hop Reasoning',
        uses: ['air:GraphTraversal'],
      },
      {
        '@id': 'air:GraphTraversal',
        '@type': 'technique',
        name: 'Graph Traversal',
        enhances: ['air:RAG'],
      },
      {
        '@id': 'air:InferenceOpt',
        '@type': 'concept',
        name: 'Inference Optimization',
        includes: ['air:Quantization', 'air:KVCacheManagement'],
      },
      {
        '@id': 'air:Quantization',
        '@type': 'technique',
        name: 'Quantization',
        optimizes: ['air:TransformerArchitecture'],
      },
      {
        '@id': 'air:KVCacheManagement',
        '@type': 'technique',
        name: 'KV Cache',
        optimizes: ['air:TransformerArchitecture'],
      },
      {
        '@id': 'air:SystemArchitecture',
        '@type': 'concept',
        name: 'System Architecture',
        includes: ['air:InferenceOpt', 'air:Guardrails'],
        requires: ['air:Observability'],
      },
      {
        '@id': 'air:Observability',
        '@type': 'component',
        name: 'Observability',
        collects: ['air:UserFeedback'],
      },
      {
        '@id': 'air:Guardrails',
        '@type': 'component',
        name: 'Guardrails',
      },
      {
        '@id': 'air:UserFeedback',
        '@type': 'concept',
        name: 'User Feedback',
        feeds: ['air:DatasetEngineering'],
      },
      {
        '@id': 'air:AIJudge',
        '@type': 'technique',
        name: 'AI-as-Judge',
        powered_by: ['air:FoundationModels'],
      },
    ],
  };
}

export function testJsonLdAgenticGraphEdges() {
  const jsonld = buildSyntheticAgenticGraphJsonLd();
  const g = parseJsonLd(jsonld);
  if (g.nodes.length !== 25) throw new Error(`ai kg jsonld nodes mismatch: ${g.nodes.length}`);
  if (g.edges.length !== 34) throw new Error(`ai kg jsonld edges mismatch: ${g.edges.length}`);
  const expectEdge = (label: string, source: string, target: string) => {
    const e = g.edges.find(x => x.label === label && String(x.source) === source && String(x.target) === target);
    if (!e) throw new Error(`missing edge ${label} from ${source} to ${target}`);
  };
  expectEdge('enables', 'air:FoundationModels', 'air:AIEngineering');
  expectEdge('uses', 'air:FoundationModels', 'air:TransformerArchitecture');
  expectEdge('requires', 'air:AIEngineering', 'air:Evaluation');
  expectEdge('includes', 'air:AIEngineering', 'air:PromptEngineering');
  expectEdge('enables', 'air:PromptEngineering', 'air:RAG');
  expectEdge('requires', 'air:RAG', 'air:Retriever');
  expectEdge('uses', 'air:Retriever', 'air:VectorSearch');
  expectEdge('requires', 'air:VectorSearch', 'air:Embeddings');
  expectEdge('generated_by', 'air:Embeddings', 'air:FoundationModels');
  expectEdge('extends_to', 'air:RAG', 'air:AgenticSystems');
  expectEdge('alternative_to', 'air:PromptEngineering', 'air:Finetuning');
  expectEdge('includes', 'air:Finetuning', 'air:PEFT');
  expectEdge('implements', 'air:PEFT', 'air:LoRA');
  expectEdge('adapts', 'air:LoRA', 'air:FoundationModels');
  expectEdge('requires', 'air:Finetuning', 'air:DatasetEngineering');
  expectEdge('requires', 'air:AgenticSystems', 'air:MemorySystem');
  expectEdge('enables', 'air:AgenticSystems', 'air:MultiHopReasoning');
  expectEdge('uses', 'air:MultiHopReasoning', 'air:GraphTraversal');
  expectEdge('enhances', 'air:GraphTraversal', 'air:RAG');
  expectEdge('uses', 'air:MemorySystem', 'air:VectorSearch');
  expectEdge('includes', 'air:InferenceOpt', 'air:Quantization');
  expectEdge('includes', 'air:InferenceOpt', 'air:KVCacheManagement');
  expectEdge('optimizes', 'air:Quantization', 'air:TransformerArchitecture');
  expectEdge('optimizes', 'air:KVCacheManagement', 'air:TransformerArchitecture');
  expectEdge('includes', 'air:SystemArchitecture', 'air:InferenceOpt');
  expectEdge('requires', 'air:SystemArchitecture', 'air:Observability');
  expectEdge('includes', 'air:SystemArchitecture', 'air:Guardrails');
  expectEdge('collects', 'air:Observability', 'air:UserFeedback');
  expectEdge('feeds', 'air:UserFeedback', 'air:DatasetEngineering');
  expectEdge('uses', 'air:Evaluation', 'air:AIJudge');
  expectEdge('powered_by', 'air:AIJudge', 'air:FoundationModels');
  expectEdge('evaluates', 'air:Evaluation', 'air:RAG');
  expectEdge('evaluates', 'air:Evaluation', 'air:Finetuning');
}

export function testJsonLdAgenticGraphRagPathStaysInNodeProperties() {
  const jsonld = {
    '@context': {
      '@vocab': 'https://schema.org/',
      concept: 'air:Concept',
      technique: 'air:Technique',
      component: 'air:Component',
      enables: { '@id': 'air:enables', '@type': '@id' },
      requires: { '@id': 'air:requires', '@type': '@id' },
      uses: { '@id': 'air:uses', '@type': '@id' },
      generated_by: { '@id': 'air:generated_by', '@type': '@id' },
      enhances: { '@id': 'air:enhances', '@type': '@id' },
    },
    '@graph': [
      {
        '@id': 'air:FoundationModels',
        '@type': 'concept',
        name: 'Foundation Models',
      },
      {
        '@id': 'air:AgenticSystems',
        '@type': 'concept',
        name: 'Agentic Systems',
        requires: ['air:MemorySystem'],
        enables: ['air:MultiHopReasoning'],
        graphRAGPath: {
          query: 'How do agentic systems use memory?',
          traverse: ['air:FoundationModels', 'air:MemorySystem', 'air:MultiHopReasoning', 'air:RAG'],
          multiHop: [
            ['air:FoundationModels', 'air:AIEngineering'],
            ['air:AIEngineering', 'air:RAG'],
          ],
        },
      },
      {
        '@id': 'air:MemorySystem',
        '@type': 'component',
        name: 'Memory System',
        uses: ['air:VectorSearch'],
      },
      {
        '@id': 'air:VectorSearch',
        '@type': 'technique',
        name: 'Vector Search',
        requires: ['air:Embeddings'],
      },
      {
        '@id': 'air:Embeddings',
        '@type': 'component',
        name: 'Embeddings',
        generated_by: 'air:FoundationModels',
      },
      {
        '@id': 'air:MultiHopReasoning',
        '@type': 'technique',
        name: 'Multi-hop Reasoning',
        uses: ['air:GraphTraversal'],
      },
      {
        '@id': 'air:GraphTraversal',
        '@type': 'technique',
        name: 'Graph Traversal',
        enhances: ['air:RAG'],
      },
      {
        '@id': 'air:RAG',
        '@type': 'technique',
        name: 'RAG',
      },
    ],
  };

  const g = parseJsonLd(jsonld);
  if (!g.nodes || g.nodes.length < 6) {
    throw new Error(`ai kg memory/agents slice nodes too small: ${g.nodes.length}`);
  }
  if (!g.edges || g.edges.length < 5) {
    throw new Error(`ai kg memory/agents slice edges too small: ${g.edges.length}`);
  }

  const expectEdge = (label: string, source: string, target: string) => {
    const e = g.edges.find(x => x.label === label && String(x.source) === source && String(x.target) === target);
    if (!e) throw new Error(`memory/agents slice missing edge ${label} from ${source} to ${target}`);
  };

  expectEdge('requires', 'air:AgenticSystems', 'air:MemorySystem');
  expectEdge('enables', 'air:AgenticSystems', 'air:MultiHopReasoning');
  expectEdge('uses', 'air:MemorySystem', 'air:VectorSearch');
  expectEdge('requires', 'air:VectorSearch', 'air:Embeddings');
  expectEdge('generated_by', 'air:Embeddings', 'air:FoundationModels');
  expectEdge('uses', 'air:MultiHopReasoning', 'air:GraphTraversal');
  expectEdge('enhances', 'air:GraphTraversal', 'air:RAG');

  const agent = g.nodes.find(n => String(n.id) === 'air:AgenticSystems');
  if (!agent) throw new Error('missing AgenticSystems node in memory/agents slice');
  const graphRagPath = agent.properties && (agent.properties as { [k: string]: unknown }).graphRAGPath;
  if (!graphRagPath || typeof graphRagPath !== 'object') {
    throw new Error('graphRAGPath missing from AgenticSystems properties in memory/agents slice');
  }
  const traverse = (graphRagPath as { [k: string]: unknown }).traverse;
  if (!Array.isArray(traverse) || traverse.length < 3) {
    throw new Error('graphRAGPath.traverse missing or too short in memory/agents slice');
  }

  const hasGraphRagPathEdge = g.edges.some(e => e.label === 'graphRAGPath');
  const hasTraverseEdge = g.edges.some(e => e.label === 'traverse');
  if (hasGraphRagPathEdge || hasTraverseEdge) {
    throw new Error('graphRAGPath or traverse were incorrectly converted to edge labels');
  }
}

export function testJsonLdWorkerPipelineParsesExpectedEdges() {
  const jsonld = {
    '@context': {
      '@vocab': 'https://schema.org/',
      air: 'http://example.org/air#',
      enables: { '@id': 'air:enables', '@type': '@id' },
      requires: { '@id': 'air:requires', '@type': '@id' },
      uses: { '@id': 'air:uses', '@type': '@id' },
    },
    '@graph': [
      { '@id': 'air:FoundationModels', '@type': 'air:Concept', name: 'Foundation Models', enables: ['air:AIEngineering'], uses: ['air:TransformerArchitecture'] },
      { '@id': 'air:AIEngineering', '@type': 'air:Concept', name: 'AI Engineering', requires: ['air:Evaluation'] },
      { '@id': 'air:Evaluation', '@type': 'air:Concept', name: 'Evaluation' },
      { '@id': 'air:TransformerArchitecture', '@type': 'air:Concept', name: 'Transformer Architecture' },
    ],
  }

  const text = JSON.stringify(jsonld)
  const g = parseGraph('synthetic.jsonld', text).data
  if (!g) throw new Error('worker pipeline returned null graph')
  if (g.nodes.length !== 4) throw new Error(`worker nodes mismatch: ${g.nodes.length}`)
  if (g.edges.length !== 3) throw new Error(`worker edges mismatch: ${g.edges.length}`)

  const expectEdge = (label: string, source: string, target: string) => {
    const e = g.edges.find(x => x.label === label && String(x.source) === source && String(x.target) === target)
    if (!e) throw new Error(`missing edge ${label} from ${source} to ${target}`)
  }
  expectEdge('enables', 'air:FoundationModels', 'air:AIEngineering')
  expectEdge('uses', 'air:FoundationModels', 'air:TransformerArchitecture')
  expectEdge('requires', 'air:AIEngineering', 'air:Evaluation')
}

export function testJsonLdTriplesMatchExpectedSet() {
  const jsonld = {
    '@context': {
      '@vocab': 'https://schema.org/',
      air: 'http://example.org/air#',
      relates: { '@id': 'air:relates', '@type': '@id' },
    },
    '@graph': [
      { '@id': 'air:A', '@type': 'air:Concept', name: 'A', relates: ['air:B', 'air:C'] },
      { '@id': 'air:B', '@type': 'air:Concept', name: 'B' },
      { '@id': 'air:C', '@type': 'air:Concept', name: 'C' },
    ],
  }

  const expectedTriples: Array<{ source: string; label: string; target: string }> = [
    { source: 'air:A', label: 'relates', target: 'air:B' },
    { source: 'air:A', label: 'relates', target: 'air:C' },
  ]

  const g = parseGraph('synthetic.jsonld', JSON.stringify(jsonld)).data
  if (!g) throw new Error('triples graph is null')
  const edges = g.edges || []
  if (edges.length === 0) throw new Error('triples graph has no edges')

  const edgeKey = (source: unknown, label: unknown, target: unknown) => `${String(source)}|${String(label)}|${String(target)}`
  const workerKeys = new Set(edges.map(e => edgeKey(e.source, e.label, e.target)))
  const expectedKeys = expectedTriples.map(t => edgeKey(t.source, t.label, t.target))

  for (const k of expectedKeys) {
    if (!workerKeys.has(k)) throw new Error(`missing triple ${k}`)
  }
}

export function testJsonLdGraphSerializerCanonicalizesOrdering() {
  const a: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'b', label: 'B', type: 'Thing', properties: { z: 1, a: 2 } },
      { id: 'a', label: 'A', type: 'Thing', properties: { b: true, a: false } },
    ],
    edges: [
      { id: 'edge-z', source: 'b', target: 'a', label: 'relates', properties: { z: 1, a: 2 } },
      { id: 'edge-a', source: 'a', target: 'b', label: 'relates', properties: { b: 1, a: 2 } },
    ],
  }
  const b: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'Thing', properties: { a: false, b: true } },
      { id: 'b', label: 'B', type: 'Thing', properties: { a: 2, z: 1 } },
    ],
    edges: [
      { id: 'edge-a', source: 'a', target: 'b', label: 'relates', properties: { a: 2, b: 1 } },
      { id: 'edge-z', source: 'b', target: 'a', label: 'relates', properties: { a: 2, z: 1 } },
    ],
  }
  const left = JSON.stringify(toJsonLd(a))
  const right = JSON.stringify(toJsonLd(b))
  if (left !== right) throw new Error('graph JSON-LD serializer should ignore non-semantic insertion ordering')
}

export function testJsonLdGraphParserCanonicalizesOrdering() {
  const context = {
    '@vocab': 'https://schema.org/',
    relates: { '@id': 'kg:relates', '@type': '@id' },
    dependsOn: { '@id': 'kg:dependsOn', '@type': '@id' },
  }
  const a = {
    '@context': context,
    '@graph': [
      { '@id': 'kg:b', '@type': 'Thing', name: 'B' },
      { '@id': 'kg:a', '@type': 'Thing', name: 'A', relates: ['kg:b'], dependsOn: ['kg:c'] },
      { '@id': 'kg:c', '@type': 'Thing', name: 'C' },
    ],
  }
  const b = {
    '@context': context,
    '@graph': [
      { '@id': 'kg:c', '@type': 'Thing', name: 'C' },
      { '@id': 'kg:a', '@type': 'Thing', name: 'A', dependsOn: ['kg:c'], relates: ['kg:b'] },
      { '@id': 'kg:b', '@type': 'Thing', name: 'B' },
    ],
  }
  const key = (graph: GraphData): string => JSON.stringify({
    nodes: graph.nodes.map(node => `${node.id}|${node.type}|${node.label}`),
    edges: graph.edges.map(edge => `${edge.source}|${edge.label}|${edge.target}`),
  })
  const left = key(parseJsonLd(a))
  const right = key(parseJsonLd(b))
  if (left !== right) throw new Error('graph JSON-LD parser should ignore non-semantic @graph/property insertion ordering')
}
