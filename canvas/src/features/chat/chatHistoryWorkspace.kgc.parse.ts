import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

const BASE_TEMPLATE_TIER_B_KEYS = [
  'product',
  'domain',
  'subject',
  'objective',
  'artifact',
  'owner',
  'version',
  'status',
] as const

const isBaseTemplateFrontmatter = (frontmatter: string, keys: Set<string>): boolean => {
  if (!keys.has('runtime') || !keys.has('pipeline') || !keys.has('mermaid') || !keys.has('flow') || !keys.has('links')) return false
  return BASE_TEMPLATE_TIER_B_KEYS.every(key => keys.has(key)) &&
    frontmatter.includes('\nruntime:') &&
    frontmatter.includes('\npipeline:') &&
    frontmatter.includes('\nmermaid:') &&
    frontmatter.includes('\nflow:') &&
    frontmatter.includes('\nlinks:')
}

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

const BASE_TEMPLATE_REQUIRED_BODY_SECTIONS = [
  '## Computing Flow Definition',
  '## Flow Graph',
  '## Pipeline',
  '## PRD — Product Requirements',
  '## TAD — Technical Architecture',
  '## Open Questions',
  '## Customization Guide',
] as const

const hasMandatoryBaseTemplateBodySections = (markdownBody: string): boolean => {
  return BASE_TEMPLATE_REQUIRED_BODY_SECTIONS.every(section => markdownBody.includes(section))
}

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
  if (!isBaseTemplateFrontmatter(parsedFrontmatterBody.frontmatter, frontmatterKeys)) return false
  if (!hasMandatoryBaseTemplateBodySections(markdownBody)) return false
  if (/```/.test(parsedFrontmatterBody.frontmatter)) return false
  const baseScalars = ['title', 'graphId', 'doc_type', 'date', 'ai_model', '$schema'] as const
  for (const key of baseScalars) {
    const scalar = extractTopLevelYamlBlockScalar(parsedFrontmatterBody.frontmatter, key).trim()
    if (!scalar) return false
  }
  for (const key of BASE_TEMPLATE_TIER_B_KEYS) {
    const scalar = extractTopLevelYamlBlockScalar(parsedFrontmatterBody.frontmatter, key).trim()
    if (!scalar) return false
  }
  if (countMatches(parsedFrontmatterBody.frontmatter, /(^|\n)\s*-\s*(?:\{id:\s*)?e[1-5]\b/g) < 5) return false
  const parsed = tryParseMarkdownFrontmatterFlowGraph('chatKnowgrph.kgc.base.md', text)
  if (!parsed) return false
  const nodes = Array.isArray(parsed.graphData.nodes) ? parsed.graphData.nodes : []
  const edges = Array.isArray(parsed.graphData.edges) ? parsed.graphData.edges : []
  return nodes.length >= 2 && edges.length >= 1
}
