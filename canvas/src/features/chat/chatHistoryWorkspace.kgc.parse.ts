import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

const KGC_REQUIRED_SECTION_ORDER = [
  '# ── DOCUMENT IDENTITY',
  'doc:',
  '# ── VARIABLES (type `@` to open CRUD toolbar)',
  '# ── NODES',
  'nodes:',
  '- @node:',
  '# ── EDGES',
  'edges:',
  '- @edge:',
  '# ── FLOW EDITOR (interactive + computable)',
  'flow:',
] as const

const KGC_REQUIRED_VARIABLE_MARKERS = [
  '\nsubject:',
  '\naction:',
  '\ngoal:',
  '\nsolution:',
] as const

const countMatches = (text: string, pattern: RegExp): number => {
  const matches = text.match(pattern)
  return Array.isArray(matches) ? matches.length : 0
}

const splitLeadingFrontmatterAndBody = (raw: string): { frontmatter: string; body: string } | null => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return null
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() !== '---') continue
    return {
      frontmatter: lines.slice(lead + 1, i).join('\n'),
      body: lines.slice(i + 1).join('\n').trim(),
    }
  }
  return null
}

const extractTopLevelYamlKeys = (frontmatter: string): Set<string> => {
  const keys = new Set<string>()
  const lines = String(frontmatter || '').split('\n')
  for (const line of lines) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]{0,48})\s*:\s*/.exec(line)
    if (!m) continue
    const key = String(m[1] || '').trim()
    if (!key) continue
    keys.add(key)
  }
  return keys
}

const extractTopLevelYamlBlockScalar = (frontmatter: string, key: string): string => {
  const lines = String(frontmatter || '').replace(/\r\n/g, '\n').split('\n')
  const keyLabel = `${String(key || '').trim()}:`
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.startsWith(keyLabel)) continue
    const rawValue = line.slice(keyLabel.length).trim()
    if (rawValue !== '|') return rawValue
    const out: string[] = []
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j]
      if (!next.trim()) {
        out.push('')
        continue
      }
      if (!/^\s+/.test(next)) break
      out.push(next.replace(/^\s{2}/, ''))
    }
    return out.join('\n').trim()
  }
  return ''
}

const extractVariableRefsFromBody = (markdownBody: string): string[] => {
  return Array.from(String(markdownBody || '').matchAll(/\{\{([^}]+)\}\}/g))
    .map(match => String(match[1] || '').trim())
    .filter(Boolean)
}

const extractVarRefKey = (raw: string): string => {
  const ref = String(raw || '').trim()
  const idxColon = ref.indexOf(':')
  const idxPipe = ref.indexOf('|')
  const cut = [idxColon, idxPipe].filter(i => i >= 0).sort((a, b) => a - b)[0]
  return (cut == null ? ref : ref.slice(0, cut)).trim()
}

const hasTemplateRef = (value: string): boolean => /\{\{[^}]+\}\}/.test(String(value || ''))

export const isKgcStructuredMarkdown = (raw: string): boolean => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return false
  if (/^```+/m.test(text)) return false
  const parsedFrontmatterBody = splitLeadingFrontmatterAndBody(text)
  if (!parsedFrontmatterBody) return false
  const frontmatter = ['---', parsedFrontmatterBody.frontmatter, '---'].join('\n')
  const markdownBody = parsedFrontmatterBody.body
  if (!markdownBody) return false
  const bodyRefs = extractVariableRefsFromBody(markdownBody)
  if (bodyRefs.length === 0) return false
  const frontmatterKeys = extractTopLevelYamlKeys(parsedFrontmatterBody.frontmatter)
  for (const ref of bodyRefs) {
    const key = extractVarRefKey(ref)
    if (!key) continue
    if (!frontmatterKeys.has(key)) return false
  }
  let searchFrom = 0
  for (const marker of KGC_REQUIRED_SECTION_ORDER) {
    const idx = frontmatter.indexOf(marker, searchFrom)
    if (idx < 0) return false
    searchFrom = idx + marker.length
  }
  if (!KGC_REQUIRED_VARIABLE_MARKERS.every(marker => frontmatter.includes(marker))) return false
  if (countMatches(frontmatter, /(^|\n)\s*-\s*@node:/g) < 2) return false
  if (countMatches(frontmatter, /(^|\n)\s*-\s*@edge:/g) < 1) return false
  const requiredInlineScalars = ['subject', 'action', 'goal', 'solution'] as const
  for (const k of requiredInlineScalars) {
    const scalar = extractTopLevelYamlBlockScalar(parsedFrontmatterBody.frontmatter, k).trim()
    if (!scalar) return false
    if (hasTemplateRef(scalar)) return false
  }
  const flowStart = frontmatter.indexOf('\nflow:')
  if (flowStart < 0) return false
  const flowText = frontmatter.slice(flowStart + 1)
  const requiredFlowSnippets = [
    'flow:',
    'direction:',
    'computed:',
    '\n  nodes:',
    '\n  edges:',
    '\n    - id:',
    '\n      type:',
    '\n      data:',
  ]
  if (!requiredFlowSnippets.every(snippet => flowText.includes(snippet))) return false
  if (/^\s*(subject|action|goal|solution)\s*:\s*["']?\s*["']?\s*$/m.test(frontmatter)) return false
  const parsed = tryParseMarkdownFrontmatterFlowGraph('chatKnowgrph.kgc.md', text)
  if (!parsed) return false
  const nodes = Array.isArray(parsed.graphData.nodes) ? parsed.graphData.nodes : []
  const edges = Array.isArray(parsed.graphData.edges) ? parsed.graphData.edges : []
  return nodes.length >= 2 && edges.length >= 1
}
