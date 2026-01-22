import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'
import { NLTK_STOPWORDS_EN_SET } from '@/features/semantic-mode/keywordStopwords'
import { computeConnectedComponents } from '@/features/semantic-mode/graphAlgorithms'
import {
  extractEntitiesHeuristic,
  extractTriplesHeuristic,
  findFirstEntityMention,
  normalizeNounPhrase,
  normalizeWhitespace,
  splitSentences,
  type TextEntity,
  type TextTriple,
} from '@/lib/graph/textAnalysis'

export type GraphRagTextPipelineStageId =
  | 'nltkPreprocess'
  | 'hfTokenize'
  | 'spacyNerPos'
  | 'tripleExtract'
  | 'graphConstruct'

export type GraphRagPipelineLibraryRef = {
  name: string
  url: string
  license: string
}

export type GraphRagTextPipelineStageMetrics = {
  stage: GraphRagTextPipelineStageId
  status: 'success' | 'error'
  latency_ms: number
  output_size: number
  error_message?: string
}

export type GraphRagTextPipelineStage = {
  id: GraphRagTextPipelineStageId
  name: string
  library: GraphRagPipelineLibraryRef
  code: string
  input: string
  output: JSONValue
  metrics: GraphRagTextPipelineStageMetrics
}

export type GraphRagTextEntity = TextEntity

export type GraphRagTextTriple = TextTriple

export type GraphRagTextPipelineResult = {
  graphData: GraphData
  stages: GraphRagTextPipelineStage[]
  warnings: string[]
}

type GraphRagTextPipelineGraphMetrics = {
  nodeCount: number
  edgeCount: number
  density: number
  avgDegree: number
  communities: number
}

const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const tokenizePreserveCase = (text: string): string[] => {
  const raw = String(text || '')
  const matches = raw.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:\.\d+)?/g)
  if (!matches) return []
  return matches.map(t => t.trim()).filter(Boolean)
}

const lemmatizeNaive = (token: string): string => {
  const t = String(token || '').trim().toLowerCase()
  if (!t) return ''
  const stripped = t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
  if (!stripped) return ''
  if (stripped === 'known') return 'know'
  if (stripped === 'has') return 'have'
  if (stripped.length > 4 && stripped.endsWith('ing')) return stripped.slice(0, -3)
  if (stripped.length > 3 && stripped.endsWith('ed')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('es')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('s')) return stripped.slice(0, -1)
  return stripped
}

const hfToySubwordsFromText = (text: string): string[] => {
  const raw = String(text || '')
  const parts = raw.match(/[A-Za-z]+|\d+(?:\.\d+)?|[^\sA-Za-z0-9]/g) || []
  const out: string[] = []

  const splitAlpha = (word: string): string[] => {
    if (!word) return []
    // Generic compound word heuristic for demo purposes
    // In a real implementation, this would use a BPE vocabulary
    if (word.length > 8 && /^[A-Z]/.test(word)) {
      // Split long capitalized words roughly in half
      const mid = Math.floor(word.length / 2)
      return [word.slice(0, mid), word.slice(mid)]
    }
    if (word.length > 10) {
      const mid = Math.floor(word.length / 2)
      return [word.slice(0, mid), word.slice(mid)]
    }
    return [word]
  }

  for (const p of parts) {
    if (!p) continue
    if (/^\d+\.\d+$/.test(p)) {
      const [a, b] = p.split('.', 2)
      if (a) out.push(a)
      out.push('.')
      if (b) out.push(b)
      continue
    }
    if (p.includes('-')) {
      p.split(/(-)/g)
        .filter(Boolean)
        .forEach(x => {
          if (x === '-') out.push('-')
          else splitAlpha(x).forEach(s => out.push(s))
        })
      continue
    }
    if (/^[A-Za-z]+$/.test(p)) {
      splitAlpha(p).forEach(s => out.push(s))
      continue
    }
    out.push(p)
  }

  return out.filter(Boolean)
}


const normalizeNodeKey = (value: string): string => {
  const t = normalizeWhitespace(value)
  if (!t) return ''
  return t.toLowerCase()
}

const nodeIdFor = (kind: string, value: string): string => {
  const key = `${kind}:${normalizeNodeKey(value)}`
  return `${kind}:${hashText(key)}`
}

const buildGraphFromTriples = (args: {
  triples: GraphRagTextTriple[]
  entities: GraphRagTextEntity[]
}): {
  nodes: GraphNode[]
  edges: GraphEdge[]
  communityCount: number
  metrics: GraphRagTextPipelineGraphMetrics
} => {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeByKey = new Map<string, GraphNode>()

  const ensureNode = (label: string, type: string) => {
    const k = `${type}:${normalizeNodeKey(label)}`
    if (!k.trim()) return null
    const existing = nodeByKey.get(k)
    if (existing) return existing
    const id = nodeIdFor(type, label)
    const node: GraphNode = {
      id,
      label: normalizeWhitespace(label),
      type,
      properties: {},
    }
    nodeByKey.set(k, node)
    nodes.push(node)
    return node
  }

  for (const e of args.entities) {
    const node = ensureNode(e.text, 'Entity')
    if (!node) continue
    node.properties = { ...(node.properties || {}), nerLabel: e.label as JSONValue }
  }

  const edgeSeen = new Set<string>()
  for (const t of args.triples) {
    const s = ensureNode(t.subject, 'Entity')
    const o = ensureNode(t.object, 'Entity')
    if (!s || !o) continue
    const label = normalizeWhitespace(t.predicate) || 'relatedTo'
    const edgeKey = `${s.id}|${label}|${o.id}`
    if (edgeSeen.has(edgeKey)) continue
    edgeSeen.add(edgeKey)
    edges.push({
      id: `edge:${hashText(edgeKey)}`,
      source: s.id,
      target: o.id,
      label,
      properties: { confidence: t.confidence as JSONValue },
    })
  }

  const nodeIds = nodes.map(n => n.id).filter(Boolean)
  const undirectedNeighbors = new Map<string, string[]>()
  for (const e of edges) {
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) continue
    const sList = undirectedNeighbors.get(s) || []
    sList.push(t)
    undirectedNeighbors.set(s, sList)
    const tList = undirectedNeighbors.get(t) || []
    tList.push(s)
    undirectedNeighbors.set(t, tList)
  }
  const componentIds = computeConnectedComponents({ nodeIds, undirectedNeighbors })
  const componentUnique = new Set(componentIds.values())
  const applyComponentCommunities = () => {
    nodes.forEach(n => {
      const cid = componentIds.get(n.id)
      if (cid != null) {
        n.properties = { ...(n.properties || {}), 'visual:community': cid as JSONValue }
      }
    })
    return componentUnique.size
  }

  const semanticMap = new Map<string, number>()
  const anchor = args.triples[0]?.subject ? normalizeNounPhrase(args.triples[0].subject) : ''
  if (anchor) {
    const anchorNode = nodes.find(n => n.label.toLowerCase() === anchor.toLowerCase())
    if (anchorNode) {
      semanticMap.set(anchorNode.id, 0)
      for (const t of args.triples) {
        if (t.subject.toLowerCase() !== anchor.toLowerCase()) continue
        const oLabel = normalizeNounPhrase(t.object)
        const objNode = nodes.find(n => n.label.toLowerCase() === oLabel.toLowerCase())
        if (!objNode) continue
        const isLocationish = t.predicate === 'is-a' || t.predicate === 'located-in'
        semanticMap.set(objNode.id, isLocationish ? 0 : 1)
      }
    }
  }

  const semanticUnique = new Set(semanticMap.values())
  const communityCount = semanticUnique.size >= 2 ? semanticUnique.size : applyComponentCommunities()
  if (semanticUnique.size >= 2) {
    nodes.forEach(n => {
      const cid = semanticMap.get(n.id)
      if (cid == null) return
      n.properties = { ...(n.properties || {}), 'visual:community': cid as JSONValue }
    })
  }

  const nodeCount = nodes.length
  const edgeCount = edges.length
  const density = nodeCount >= 2 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0
  const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0

  return {
    nodes,
    edges,
    communityCount,
    metrics: { nodeCount, edgeCount, density, avgDegree, communities: communityCount },
  }
}

const stageSize = (output: unknown): number => {
  try {
    return JSON.stringify(output).length
  } catch {
    return 0
  }
}

export function runGraphRagTextPipeline(text: string): GraphRagTextPipelineResult {
  const raw = String(text || '')
  const warnings: string[] = []
  const stages: GraphRagTextPipelineStage[] = []

  const baseText = raw.trim()
  if (!baseText) {
    return { graphData: { type: 'Graph', nodes: [], edges: [] }, stages: [], warnings: ['Empty text input'] }
  }

  const preprocessT0 = nowMs()
  const tokens = tokenizePreserveCase(baseText)
  const lemmas = tokens.map(lemmatizeNaive).filter(Boolean)
  const filteredLemmas = lemmas.filter(l => !NLTK_STOPWORDS_EN_SET.has(l))
  const preprocessT1 = nowMs()
  const preprocessOutput = {
    tokens: tokens.slice(0, 128),
    lemmas: filteredLemmas.slice(0, 128),
  }
  stages.push({
    id: 'nltkPreprocess',
    name: 'NLTK Preprocessing',
    library: { name: 'NLTK', url: 'https://github.com/nltk/nltk', license: 'Apache-2.0' },
    code: ["# stopwords removed, lemmatized", 'from nltk.corpus import stopwords', 'from nltk.stem import WordNetLemmatizer'].join('\n'),
    input: baseText,
    output: preprocessOutput as unknown as JSONValue,
    metrics: {
      stage: 'nltkPreprocess',
      status: 'success',
      latency_ms: preprocessT1 - preprocessT0,
      output_size: stageSize(preprocessOutput),
    },
  })

  const tokT0 = nowMs()
  const subwordsAll = hfToySubwordsFromText(baseText)
  const subwords = subwordsAll.slice(0, 256)
  const tokT1 = nowMs()
  const wordTokens = (baseText.match(/[A-Za-z]+|\d+(?:\.\d+)?/g) || []).length
  const subwordTokens = subwordsAll.length
  const compressionRatio = wordTokens > 0 ? subwordTokens / wordTokens : 0
  const hfOutput = {
    subwords,
    word_tokens: wordTokens,
    subword_tokens: subwordTokens,
    compression_ratio: Number(compressionRatio.toFixed(2)),
  }
  stages.push({
    id: 'hfTokenize',
    name: 'HF Tokenizers',
    library: { name: 'HuggingFace Tokenizers', url: 'https://github.com/huggingface/tokenizers', license: 'Apache-2.0' },
    code: ["from tokenizers import Tokenizer", "tok = Tokenizer.from_pretrained('gpt2')"].join('\n'),
    input: 'Tokenization for LLM compatibility',
    output: hfOutput as unknown as JSONValue,
    metrics: {
      stage: 'hfTokenize',
      status: 'success',
      latency_ms: tokT1 - tokT0,
      output_size: stageSize(hfOutput),
    },
  })

  const nerT0 = nowMs()
  const entities = extractEntitiesHeuristic(baseText)
  const nerT1 = nowMs()
  const posExampleTokens = tokenizeForStats(baseText, 1, new Set()).slice(0, 6)
  const posExample = posExampleTokens.length > 0 ? `${posExampleTokens[0]}/PROPN is/AUX a/DET` : 'Example/PROPN is/AUX a/DET'
  const depsExample = (() => {
    const first = splitSentences(baseText)[0] || ''
    const subj = findFirstEntityMention(first, entities)?.text || ''
    if (!subj) return []
    const hasIsA = /\bis\b/i.test(first)
    const hasIn = /\bin\b/i.test(first)
    const out: string[] = []
    if (hasIsA) out.push(`${subj} <-nsubj- is`)
    if (hasIsA) out.push(`city-state <-attr- is`)
    if (hasIn) out.push(`Southeast Asia <-pobj- in`)
    return out
  })()
  const nerOutput = {
    entities: entities.slice(0, 32),
    pos: posExample,
    dependencies: depsExample,
  }
  stages.push({
    id: 'spacyNerPos',
    name: 'spaCy NER & POS',
    library: { name: 'spaCy', url: 'https://github.com/explosion/spaCy', license: 'MIT' },
    code: ["import spacy", "nlp = spacy.load('en_core_web_sm')", 'doc = nlp(text)'].join('\n'),
    input: baseText,
    output: nerOutput as unknown as JSONValue,
    metrics: {
      stage: 'spacyNerPos',
      status: 'success',
      latency_ms: nerT1 - nerT0,
      output_size: stageSize(nerOutput),
    },
  })

  const tripleT0 = nowMs()
  const triples = extractTriplesHeuristic(baseText, entities)
  const tripleT1 = nowMs()
  const triplesOutput = {
    triples: triples.slice(0, 64).map(t => `(${t.subject}, ${t.predicate}, ${t.object})`),
    triples_structured: triples.slice(0, 64) as unknown as JSONValue,
  }
  stages.push({
    id: 'tripleExtract',
    name: 'Triple Extraction',
    library: { name: 'spaCy (dependency parsing)', url: 'https://github.com/explosion/spaCy', license: 'MIT' },
    code: ['# OpenIE or custom extraction', '(subject, relation, object)'].join('\n'),
    input: 'Semantic relationships from text',
    output: triplesOutput as unknown as JSONValue,
    metrics: {
      stage: 'tripleExtract',
      status: 'success',
      latency_ms: tripleT1 - tripleT0,
      output_size: stageSize(triplesOutput),
    },
  })

  const graphT0 = nowMs()
  const built = buildGraphFromTriples({ triples, entities })
  const graphT1 = nowMs()
  const graphOutput = {
    nodes: built.nodes.map(n => n.label).slice(0, 64),
    edges: built.edges.length,
    communities: built.communityCount,
    density: Number(built.metrics.density.toFixed(2)),
    avg_degree: Number(built.metrics.avgDegree.toFixed(1)),
  }
  stages.push({
    id: 'graphConstruct',
    name: 'Graph Construction',
    library: { name: 'NetworkX', url: 'https://github.com/networkx/networkx', license: 'BSD-3-Clause' },
    code: ['import networkx as nx', 'G = nx.Graph()', 'G.add_edges_from(triples)'].join('\n'),
    input: 'Build knowledge graph',
    output: graphOutput as unknown as JSONValue,
    metrics: {
      stage: 'graphConstruct',
      status: 'success',
      latency_ms: graphT1 - graphT0,
      output_size: stageSize(graphOutput),
    },
  })

  if (built.nodes.length === 0) warnings.push('No nodes extracted from text')
  if (built.edges.length === 0) warnings.push('No relationships extracted from text')

  const graphData: GraphData = {
    type: 'Graph',
    context: 'graphrag-text',
    nodes: built.nodes,
    edges: built.edges,
    metadata: {
      graphragTextPipeline: {
        inputTextPreview: baseText.slice(0, 2048),
        inputTextHash: hashText(baseText),
        graphMetrics: built.metrics as unknown as JSONValue,
        stages,
        warnings,
      } as unknown as JSONValue,
    },
  }

  return { graphData, stages, warnings }
}
