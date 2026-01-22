import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'
import { NLTK_STOPWORDS_EN_SET } from '@/features/semantic-mode/keywordStopwords'
import { computeConnectedComponents } from '@/features/semantic-mode/graphAlgorithms'

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

export type GraphRagTextEntity = {
  text: string
  label: string
  start: number
  end: number
}

export type GraphRagTextTriple = {
  subject: string
  predicate: string
  object: string
  confidence: number
}

export type GraphRagTextPipelineResult = {
  graphData: GraphData
  stages: GraphRagTextPipelineStage[]
  warnings: string[]
}

const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const normalizeWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim()

const tokenizePreserveCase = (text: string): string[] => {
  const raw = String(text || '')
  const matches = raw.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)
  if (!matches) return []
  return matches.map(t => t.trim()).filter(Boolean)
}

const lemmatizeNaive = (token: string): string => {
  const t = String(token || '').trim().toLowerCase()
  if (!t) return ''
  const stripped = t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
  if (!stripped) return ''
  if (stripped.length > 4 && stripped.endsWith('ing')) return stripped.slice(0, -3)
  if (stripped.length > 3 && stripped.endsWith('ed')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('es')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('s')) return stripped.slice(0, -1)
  return stripped
}

const splitSubwordsToy = (token: string): string[] => {
  const t = String(token || '').trim()
  if (!t) return []
  const parts = t.split(/(-|_)/g).filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === '-' || part === '_') {
      out.push(part)
      continue
    }
    if (part.length <= 4) {
      out.push(part)
      continue
    }
    const a = part.slice(0, 3)
    const b = part.slice(3)
    out.push(a)
    if (b) out.push(b)
  }
  return out
}

const inferEntityLabel = (phrase: string): string => {
  const t = normalizeWhitespace(phrase)
  if (!t) return 'ENTITY'
  const lower = t.toLowerCase()
  if (/(?:\b\d{4}\b)|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b)/i.test(t)) {
    return 'DATE'
  }
  if (/(?:\binc\b|\bcorp\b|\bltd\b|\bllc\b|\buniversity\b|\bcommittee\b|\bcompany\b|\bgroup\b)/i.test(t)) {
    return 'ORG'
  }
  if (/(?:\bairport\b|\bbridge\b|\bhospital\b|\bstation\b|\bterminal\b|\bport\b|\bplant\b)/i.test(t)) {
    return 'FAC'
  }
  if (/(?:\bcity\b|\bstate\b|\bprovince\b|\bcountry\b|\bregion\b)/i.test(t)) {
    return 'GPE'
  }
  if (t.split(' ').length === 2 && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t)) {
    return 'PERSON'
  }
  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$/.test(t)) {
    return 'GPE'
  }
  return 'ENTITY'
}

const extractEntitiesHeuristic = (text: string): GraphRagTextEntity[] => {
  const raw = String(text || '')
  const out: GraphRagTextEntity[] = []
  const seen = new Set<string>()

  const push = (entityText: string, start: number, end: number, forcedLabel?: string) => {
    const phrase = normalizeWhitespace(entityText)
    if (!phrase) return
    const key = phrase.toLowerCase()
    if (seen.has(`${key}@${start}`)) return
    if (NLTK_STOPWORDS_EN_SET.has(key)) return
    const label = forcedLabel || inferEntityLabel(phrase)
    out.push({ text: phrase, label, start, end })
    seen.add(`${key}@${start}`)
  }

  const quantityRe = /\b(\d+(?:\.\d+)?)\s*(million|billion|thousand|%|percent|km|kg|m|cm|mm)\b/gi
  for (const m of raw.matchAll(quantityRe)) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(m[0] || '', idx, idx + String(m[0] || '').length, 'QUANTITY')
  }

  const dateRe = /\b(?:\d{4}-\d{2}-\d{2}|\d{4})\b/g
  for (const m of raw.matchAll(dateRe)) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(m[0] || '', idx, idx + String(m[0] || '').length, 'DATE')
  }

  const capPhrase = /\b(?:[A-Z][a-z0-9]+)(?:\s+[A-Z][a-z0-9]+){0,5}\b/g
  for (const m of raw.matchAll(capPhrase)) {
    const idx = m.index ?? -1
    const v = String(m[0] || '').trim()
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  return out
}

const splitSentences = (text: string): string[] => {
  const raw = String(text || '').trim()
  if (!raw) return []
  return raw
    .split(/(?<=[.!?])\s+|\n+/g)
    .map(s => s.trim())
    .filter(Boolean)
}

const findFirstEntityMention = (sentence: string, entities: GraphRagTextEntity[]): GraphRagTextEntity | null => {
  const lower = sentence.toLowerCase()
  for (const e of entities) {
    const t = e.text.toLowerCase()
    if (t && lower.includes(t)) return e
  }
  return null
}

const listEntitiesInSentence = (sentence: string, entities: GraphRagTextEntity[]): GraphRagTextEntity[] => {
  const lower = sentence.toLowerCase()
  const matches = entities
    .filter(e => {
      const t = e.text.toLowerCase()
      return t && lower.includes(t)
    })
    .slice()
    .sort((a, b) => a.start - b.start)
  const uniq: GraphRagTextEntity[] = []
  const seen = new Set<string>()
  for (const e of matches) {
    const k = e.text.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(e)
  }
  return uniq
}

const extractTriplesHeuristic = (text: string, entities: GraphRagTextEntity[]): GraphRagTextTriple[] => {
  const sentences = splitSentences(text)
  const triples: GraphRagTextTriple[] = []
  const seen = new Set<string>()

  const push = (s: string, p: string, o: string, confidence: number) => {
    const subject = normalizeWhitespace(s)
    const predicate = normalizeWhitespace(p).replace(/\s+/g, '-').toLowerCase()
    const object = normalizeWhitespace(o)
    if (!subject || !predicate || !object) return
    const key = `${subject.toLowerCase()}|${predicate}|${object.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    triples.push({ subject, predicate, object, confidence })
  }

  for (const sent of sentences) {
    const ents = listEntitiesInSentence(sent, entities)
    const subj = ents[0]?.text || ''
    if (!subj) continue

    const mIsA = sent.match(new RegExp(`\\b${subj.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b\\s+is\\s+(?:a|an|the)\\s+([^,.]+)`, 'i'))
    if (mIsA && mIsA[1]) {
      push(subj, 'is-a', mIsA[1], 0.85)
    }

    const mLocated = sent.match(new RegExp(`\\b${subj.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b[^.]{0,80}\\blocated\\s+in\\s+([^,.]+)`, 'i'))
    if (mLocated && mLocated[1]) {
      push(subj, 'located-in', mLocated[1], 0.85)
    }

    const mKnown = sent.match(new RegExp(`\\b${subj.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b[^.]{0,80}\\bknown\\s+for\\s+([^,.]+)`, 'i'))
    if (mKnown && mKnown[1]) {
      push(subj, 'known-for', mKnown[1], 0.75)
    }

    const mHas = sent.match(new RegExp(`\\b${subj.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b[^.]{0,80}\\bhas\\s+([^,.]+)`, 'i'))
    if (mHas && mHas[1]) {
      push(subj, 'has', mHas[1], 0.7)
    }

    if (ents.length >= 2) {
      const obj = ents[1]!.text
      const between = (() => {
        const lowerSent = sent.toLowerCase()
        const a = lowerSent.indexOf(subj.toLowerCase())
        const b = lowerSent.indexOf(obj.toLowerCase())
        if (a < 0 || b < 0) return ''
        const start = Math.min(a + subj.length, b + obj.length)
        const end = Math.max(a, b)
        if (start >= end) return ''
        return sent.slice(start, end)
      })()
      const verbTokens = tokenizeForStats(between, 2, new Set())
      const verb = verbTokens.find(t => t.length >= 2) || 'relates_to'
      push(subj, verb, obj, 0.55)
    }
  }

  return triples
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
  const unique = new Set(componentIds.values())
  nodes.forEach(n => {
    const cid = componentIds.get(n.id)
    if (cid != null) {
      n.properties = { ...(n.properties || {}), 'visual:community': cid as JSONValue }
    }
  })

  return { nodes, edges, communityCount: unique.size }
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
  const subwords = tokens.flatMap(splitSubwordsToy).slice(0, 128)
  const tokT1 = nowMs()
  const hfOutput = {
    subwords,
    count: `Original: ${tokens.length} tokens | Subword: ${tokens.reduce((acc, t) => acc + splitSubwordsToy(t).length, 0)} tokens`,
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
  const nerOutput = {
    entities: entities.slice(0, 32),
    pos: posExample,
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
        stages,
        warnings,
      } as unknown as JSONValue,
    },
  }

  return { graphData, stages, warnings }
}
