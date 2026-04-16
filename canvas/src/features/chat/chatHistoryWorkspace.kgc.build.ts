type KgcStructuredTurnArgs = {
  timestampMs: number
  requestText: string
  assistantText: string
}

const KGC_RECOVERY_OMITTED_NOTE =
  'Previous invalid KGC attempt was omitted. Regenerate the answer as plain markdown body content linked to the YAML frontmatter.'

const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatIsoDateOnly = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  return `${yyyy}-${mm}-${dd}`
}

const formatReadableTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`
}

const formatCompactTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}${mm}${dd}${hh}${min}${sec}`
}

const wrapFence = (content: string, lang: string): string => {
  const safeLang = String(lang || '').trim() || 'text'
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const ticks = safe.includes('```') ? '````' : '```'
  return [`${ticks}${safeLang}`, safe, ticks].join('\n')
}

const yamlString = (value: string): string => JSON.stringify(String(value || ''))

const normalizeInlineValue = (value: string, fallback: string, maxChars = 160): string => {
  const cleaned = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
  return cleaned || fallback
}

const extractFirstFencedBlock = (raw: string, lang?: string): string | null => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const langPart = lang ? `${lang}\\s*` : '[^\\n]*'
  const rx = new RegExp(`(^|\\n)\\s*\`\`\`${langPart}\\n([\\s\\S]*?)\\n\\s*\`\`\``, 'i')
  const match = text.match(rx)
  return match && typeof match[2] === 'string' ? String(match[2] || '').trim() : null
}

const normalizeEscapedKgcArtifacts = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  return text
    .replace(/^\s*\\`\\`\\`\s*kgc\s*$/gim, '')
    .replace(/^\s*\\`\\`\\`\s*$/gm, '')
    .replace(/^\s*kgc\s*$(\n\s*\\---\s*$)?/gim, match => match.includes('\\---') ? '---' : '')
    .replace(/^\s*\\---\s*$/gm, '---')
    .replace(/^\s*\\\.\.\.\s*$/gm, '...')
}

const stripFenceWrappers = (raw: string): string => {
  let text = normalizeEscapedKgcArtifacts(raw).trim()
  text = text.replace(/\\`\\`\\`[^\n]*\n([\s\S]*?)\n\\`\\`\\`/g, '$1')
  text = text.replace(/```[^\n]*\n([\s\S]*?)\n```/g, '$1')
  return text.trim()
}

const normalizeBlankLines = (raw: string): string => {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const looksLikeKgcDocumentArtifact = (raw: string): boolean => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return false
  return (
    text.startsWith('---') ||
    text.includes('# ── DOCUMENT IDENTITY') ||
    text.includes('# ── VARIABLES (type `@` to open CRUD toolbar)') ||
    text.includes('flow:')
  )
}

const hasResidualKgcArtifactLines = (raw: string): boolean => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  return /\n\s*kgc\s*\n/i.test(`\n${text}\n`) || text.includes('\\---')
}

const normalizeRecoveredAssistantBody = (raw: string): string => {
  let text = normalizeBlankLines(raw)
  if (!text) return ''
  text = text
    .replace(/^#\s+\{\{subject\}\}\s*\n+/i, '')
    .replace(/^##\s+\{\{subject\}\}\s*\n+/i, '')
    .replace(/^#\s+\{\{solution(?:[:|][^}]*)?\}\}\s*\n+/i, '')
    .replace(/^##\s+\{\{solution(?:[:|][^}]*)?\}\}\s*\n+/i, '')
    .replace(/^###\s+\{\{solution(?:[:|][^}]*)?\}\}\s*\n+/i, '')
    .replace(/^##\s+Intent\s*[\s\S]*?(?=\n##\s+Request\b|\n##\s+Solution\b|$)/i, '')
    .replace(/^##\s+Request\s*[\s\S]*?(?=\n##\s+Solution\b|$)/i, '')
    .replace(/^##\s+Solution\s*\n+/i, '')
  return normalizeBlankLines(text)
}

const sanitizeAssistantBodyForKgc = (raw: string): string => {
  return normalizeBlankLines(
    String(raw || '')
      .replace(/^\s*```+[^\n]*$/gm, '')
      .replace(/^\s*\\`\\`\\`[^\n]*$/gm, '')
  )
}

const isUsableRecoveredBody = (raw: string): boolean => {
  const text = String(raw || '').trim()
  if (!text) return false
  if (/\\`\\`\\`|```/.test(text)) return false
  if (looksLikeKgcDocumentArtifact(text)) return false
  if (hasResidualKgcArtifactLines(text)) return false
  return true
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

const extractBodyAfterLeadingFrontmatter = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return text.trim()
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() !== '---') continue
    return lines.slice(i + 1).join('\n').trim()
  }
  return text.trim()
}

const extractBodyAfterEmbeddedFrontmatter = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const separators: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') separators.push(i)
  }
  if (separators.length < 2) return ''
  for (let i = 0; i < separators.length - 1; i += 1) {
    const closeIdx = separators[i + 1]
    const body = lines.slice(closeIdx + 1).join('\n').trim()
    if (!body) continue
    if ((body.match(/^##?\s+/gm) || []).length >= 2 || body.split(/\s+/).filter(Boolean).length >= 24) {
      return body
    }
  }
  return lines.slice(separators[1] + 1).join('\n').trim()
}

const deriveCanonicalAssistantMarkdownBody = (raw: string): string => {
  const initial = normalizeEscapedKgcArtifacts(raw).trim()
  if (!initial) return 'TBD'

  const fencedKgc = extractFirstFencedBlock(initial, 'kgc')
  const unfenced = fencedKgc || initial
  const bodyCandidate = extractBodyAfterLeadingFrontmatter(unfenced)
  const embeddedBodyCandidate = extractBodyAfterEmbeddedFrontmatter(unfenced)
  const strippedBody = stripFenceWrappers(bodyCandidate)
  const strippedEmbeddedBody = stripFenceWrappers(embeddedBodyCandidate)
  const frontmatterBody = splitLeadingFrontmatterAndBody(unfenced)
  const solutionMdFromFrontmatter = stripFenceWrappers(
    frontmatterBody
      ? extractTopLevelYamlBlockScalar(frontmatterBody.frontmatter, 'solution_md')
      : extractTopLevelYamlBlockScalar(unfenced, 'solution_md')
  )
  if (isUsableRecoveredBody(strippedBody)) {
    return normalizeRecoveredAssistantBody(strippedBody)
  }
  if (isUsableRecoveredBody(strippedEmbeddedBody)) {
    return normalizeRecoveredAssistantBody(strippedEmbeddedBody)
  }
  if (isUsableRecoveredBody(solutionMdFromFrontmatter)) {
    return normalizeRecoveredAssistantBody(solutionMdFromFrontmatter)
  }

  const strippedInitial = stripFenceWrappers(initial)
  if (looksLikeKgcDocumentArtifact(strippedInitial)) {
    const candidateBody = normalizeBlankLines(
      stripFenceWrappers(extractBodyAfterLeadingFrontmatter(strippedInitial) || extractBodyAfterEmbeddedFrontmatter(strippedInitial))
    )
      .replace(/^\s*kgc\s*$/gim, '')
      .replace(/^\s*\\---\s*$/gm, '')
      .trim()
    if (isUsableRecoveredBody(candidateBody)) {
      return normalizeRecoveredAssistantBody(candidateBody)
    }
    if (isUsableRecoveredBody(solutionMdFromFrontmatter)) {
      return normalizeRecoveredAssistantBody(solutionMdFromFrontmatter)
    }
    return KGC_RECOVERY_OMITTED_NOTE
  }
  if (strippedInitial && !/\\`\\`\\`|```/.test(strippedInitial)) {
    return normalizeRecoveredAssistantBody(strippedInitial)
  }

  return normalizeRecoveredAssistantBody(
    initial
      .replace(/\\`\\`\\`|```/g, '')
      .replace(/^\s*kgc\s*$/gim, '')
      .replace(/^\s*\\---\s*$/gm, '')
  )
}

const buildDeterministicKgcRecoverySolutionMd = (requestText: string): string => {
  const request = String(requestText || '').replace(/\r\n/g, '\n').trim()
  const firstLine = request.split('\n').find(Boolean) || ''
  const topic = normalizeInlineValue(firstLine || request, 'request', 180)
  return [
    '## Recovery notice',
    '- A previous assistant payload was not safely recoverable into this KGC document.',
    '- This file remains valid and editable; regenerate the response content and replace this section.',
    '',
    '## Requested scope',
    `- ${topic}`,
    '',
    '## Regeneration constraints',
    '- Keep YAML frontmatter values concrete; avoid {{}} inside scalar fields.',
    '- Ensure every {{key}} used in the body is declared in frontmatter.',
    '- Avoid nested code fences; put long content in YAML block scalars.',
  ].join('\n')
}

const stripTemplateRefsFromInline = (value: string): string => {
  return String(value || '')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const summarizeAssistantBodyForSolutionScalar = (value: string): string => {
  return stripTemplateRefsFromInline(
    String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  )
}

const toKgcNodeId = (value: string, fallback: string): string => {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const sliced = cleaned
    .slice(0, 24)
    .replace(/^-+|-+$/g, '')

  return sliced ? `n-${sliced}` : fallback
}

export const buildKgcStructuredTurn = (args: KgcStructuredTurnArgs): string => {
  const compactId = formatCompactTimestamp(args.timestampMs)
  const created = formatIsoDateOnly(args.timestampMs)
  const subject = normalizeInlineValue(args.requestText, 'chat request')
  const recoveredAssistantMdRaw = deriveCanonicalAssistantMarkdownBody(args.assistantText)
  const assistantMd = sanitizeAssistantBodyForKgc(
    recoveredAssistantMdRaw === KGC_RECOVERY_OMITTED_NOTE
      ? buildDeterministicKgcRecoverySolutionMd(args.requestText)
      : recoveredAssistantMdRaw
  ) || 'TBD'
  const solution = normalizeInlineValue(summarizeAssistantBodyForSolutionScalar(assistantMd), 'assistant response')
  const requestNodeId = toKgcNodeId(subject, 'n-user-request')
  const responseNodeId = toKgcNodeId(solution, 'n-ai-response')
  const requestMd = String(args.requestText || '').replace(/\r\n/g, '\n').trim() || 'TBD'
  return [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    `  id: ${yamlString(`doc:kgc:turn:${compactId}`)}`,
    `  title: ${yamlString('chatKnowgrph turn')}`,
    '  type: chatKnowgrph',
    `  version: ${yamlString('1.0.0')}`,
    `  created: ${yamlString(created)}`,
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    `subject:  ${yamlString(subject)}`,
    `action:   ${yamlString('respond to the active request')}`,
    `goal:     ${yamlString('persist one ingestible chat turn')}`,
    `solution: ${yamlString(solution)}`,
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    'nodes:',
    `  - @node:${requestNodeId}:  { label: "{{subject}}",  type: input   }`,
    `  - @node:${responseNodeId}: { label: "{{solution}}", type: output  }`,
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    `  - @edge:${requestNodeId}:turn → ${responseNodeId}:turn`,
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    'flow:',
    '  direction:  LR',
    '  edgeType:   smoothstep',
    '  snapToGrid: true',
    '  gridSize:   20',
    '  computed:   false',
    '',
    '  nodes:',
    `    - id:    ${requestNodeId}`,
    '      type:  input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 60 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        role: "user"',
    '        text: "{{subject}}"',
    '      annotation: "`bg#E1F5EE:input`"',
    '',
    `    - id:    ${responseNodeId}`,
    '      type:  output',
    '      label: "{{solution}}"',
    '      position: { x: 360, y: 60 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        role: "assistant"',
    '        text: "{{solution}}"',
    '      annotation: "`bg#EAF3DE:output`"',
    '',
    '  edges:',
    `    - source: ${requestNodeId}.turn`,
    `      target: ${responseNodeId}.turn`,
    '      label: "responds"',
    '',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    requestMd,
    '',
    '## Solution',
    assistantMd,
  ].join('\n')
}

import { isKgcStructuredMarkdown } from './chatHistoryWorkspace.kgc.parse'

export const normalizeKgcAssistantBodyForStorage = (args: KgcStructuredTurnArgs): string => {
  const raw = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
  if (isKgcStructuredMarkdown(raw)) return raw
  return buildKgcStructuredTurn(args)
}

export const buildKgcWorkspaceDocument = (args: {
  canonicalKgc: string
  historyBody?: string
}): string => {
  const canonical = String(args.canonicalKgc || '').replace(/\r\n/g, '\n').trim()
  return `${canonical.trimEnd()}\n`
}

export const buildKgcDraftEntry = (args: {
  timestampMs: number
  traceId: string
  providerSummary: string
  userText: string
  assistantText: string
}): string => {
  const heading = `## ${formatReadableTimestamp(args.timestampMs)} (in progress)`
  const assistantMarkdown = String(args.assistantText || '_Streaming..._').replace(/\r\n/g, '\n').trim() || '_Streaming..._'
  return [
    `<!-- kg-chat-draft:start:${args.traceId} -->`,
    heading,
    '',
    `Trace-ID: ${args.traceId}`,
    '',
    `Provider: ${String(args.providerSummary || '').trim() || 'unknown'}`,
    '',
    '### user',
    wrapFence(args.userText, 'text'),
    '',
    '### assistant',
    wrapFence(assistantMarkdown, 'markdown'),
    `<!-- kg-chat-draft:end:${args.traceId} -->`,
    '',
  ].join('\n')
}
