import { extractYamlFrontmatterBlock } from '@/lib/markdown/frontmatter'

export type MermaidGitGraphCommandKind = 'commit' | 'branch' | 'checkout' | 'merge' | 'cherry-pick' | 'unknown'

export type MermaidGitGraphCommand = {
  key: string
  lineIndex: number
  lineNumber: number
  raw: string
  indent: string
  kind: MermaidGitGraphCommandKind
  label: string
  target?: string
  commitId?: string
  tag?: string
  type?: string
  parent?: string
}

export type MermaidGitGraphModel = {
  code: string
  lines: string[]
  declarationLineIndex: number
  commandIndent: string
  commands: MermaidGitGraphCommand[]
}

export type MermaidGitGraphAddKind = 'commit' | 'branch' | 'merge' | 'cherry-pick'

const GITGRAPH_DECLARATION_RE = /^\s*gitGraph(?:\s+(?:LR|TB|BT))?\s*:?\s*$/i
const YAML_KEY_RE = /^[A-Za-z0-9_.-]+\s*:/

const readCommandKind = (trimmedLine: string): MermaidGitGraphCommandKind => {
  const raw = trimmedLine.split(/\s+/, 1)[0] || ''
  if (raw === 'cherry-pick') return 'cherry-pick'
  if (raw === 'commit' || raw === 'branch' || raw === 'checkout' || raw === 'merge') return raw
  if (raw === 'switch') return 'checkout'
  return 'unknown'
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const readAttrValue = (line: string, key: string): string => {
  const re = new RegExp(`(?:^|\\s)${escapeRegExp(key)}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^\\s]+))`)
  const match = line.match(re)
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

const readQuotedPositionalValue = (line: string): string => {
  const match = line.match(/^\s*[A-Za-z-]+\s+(?:"([^"]+)"|'([^']+)')/)
  return String(match?.[1] ?? match?.[2] ?? '').trim()
}

const readTargetValue = (line: string, kind: MermaidGitGraphCommandKind): string => {
  if (kind !== 'branch' && kind !== 'checkout' && kind !== 'merge') return ''
  const match = line.match(/^\s*(?:branch|checkout|switch|merge)\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

const normalizeComparableLabel = (value: string | null | undefined): string => {
  return String(value || '').trim().toLowerCase()
}

const readCommandLabel = (args: {
  kind: MermaidGitGraphCommandKind
  target: string
  commitId: string
  tag: string
  parent: string
  raw: string
}): string => {
  if (args.kind === 'commit') return args.commitId || args.tag || readQuotedPositionalValue(args.raw) || args.raw.trim()
  if (args.kind === 'branch' || args.kind === 'checkout' || args.kind === 'merge') return args.target || args.raw.trim()
  if (args.kind === 'cherry-pick') return args.commitId || args.parent || args.raw.trim()
  return args.raw.trim()
}

export const parseMermaidGitGraphModel = (code: string): MermaidGitGraphModel => {
  const normalizedCode = String(code || '').replace(/\r/g, '')
  const lines = normalizedCode.split('\n')
  const declarationLineIndex = lines.findIndex(line => GITGRAPH_DECLARATION_RE.test(line.trim()))
  const commands: MermaidGitGraphCommand[] = []
  if (declarationLineIndex >= 0) {
    for (let i = declarationLineIndex + 1; i < lines.length; i += 1) {
      const raw = lines[i] || ''
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('%%')) continue
      const kind = readCommandKind(trimmed)
      if (kind === 'unknown') continue
      const indent = raw.match(/^\s*/)?.[0] || ''
      const target = readTargetValue(trimmed, kind)
      const commitId = readAttrValue(trimmed, 'id')
      const tag = readAttrValue(trimmed, 'tag')
      const type = readAttrValue(trimmed, 'type')
      const parent = readAttrValue(trimmed, 'parent')
      const label = readCommandLabel({ kind, target, commitId, tag, parent, raw: trimmed })
      commands.push({
        key: `${i}:${kind}:${label}`,
        lineIndex: i,
        lineNumber: i + 1,
        raw: trimmed,
        indent,
        kind,
        label,
        target: target || undefined,
        commitId: commitId || undefined,
        tag: tag || undefined,
        type: type || undefined,
        parent: parent || undefined,
      })
    }
  }
  const commandIndent = commands.find(command => command.indent)?.indent || '  '
  return {
    code: normalizedCode,
    lines,
    declarationLineIndex,
    commandIndent,
    commands,
  }
}

export const findMermaidGitGraphCommandForLabel = (
  commands: ReadonlyArray<MermaidGitGraphCommand>,
  label: string | null | undefined,
): MermaidGitGraphCommand | null => {
  const normalized = normalizeComparableLabel(label)
  if (!normalized) return null
  const exact = commands.find(command => {
    return [
      command.commitId,
      command.tag,
      command.target,
      command.label,
    ].some(value => normalizeComparableLabel(value) === normalized)
  })
  if (exact) return exact
  return commands.find(command => normalizeComparableLabel(command.raw).includes(normalized)) || null
}

const sanitizeCommandLine = (line: string): string => {
  return String(line || '').replace(/\r/g, '').split('\n')[0]?.trim() || ''
}

const serializeLines = (lines: ReadonlyArray<string>): string => lines.join('\n').replace(/\s+$/g, '')

export const updateMermaidGitGraphCommandLine = (code: string, lineIndex: number, nextLine: string): string => {
  const model = parseMermaidGitGraphModel(code)
  if (lineIndex <= model.declarationLineIndex || lineIndex >= model.lines.length) return model.code
  const cleanLine = sanitizeCommandLine(nextLine)
  if (!cleanLine) return model.code
  const lines = model.lines.slice()
  const previousIndent = lines[lineIndex]?.match(/^\s*/)?.[0] || model.commandIndent
  lines[lineIndex] = `${previousIndent}${cleanLine}`
  return serializeLines(lines)
}

export const deleteMermaidGitGraphCommandLine = (code: string, lineIndex: number): string => {
  const model = parseMermaidGitGraphModel(code)
  if (lineIndex <= model.declarationLineIndex || lineIndex >= model.lines.length) return model.code
  const commands = new Set(model.commands.map(command => command.lineIndex))
  if (!commands.has(lineIndex)) return model.code
  const lines = model.lines.slice()
  lines.splice(lineIndex, 1)
  return serializeLines(lines)
}

const readTokenSet = (model: MermaidGitGraphModel): Set<string> => {
  const tokens = new Set<string>()
  for (const command of model.commands) {
    for (const value of [command.commitId, command.tag, command.target]) {
      const normalized = normalizeComparableLabel(value)
      if (normalized) tokens.add(normalized)
    }
  }
  return tokens
}

const nextUniqueToken = (tokens: Set<string>, prefix: string): string => {
  for (let i = 1; i < 10000; i += 1) {
    const token = `${prefix}_${i}`
    if (!tokens.has(normalizeComparableLabel(token))) return token
  }
  return `${prefix}_${Date.now()}`
}

const readBranchTargets = (model: MermaidGitGraphModel): string[] => {
  const seen = new Set<string>()
  const branches: string[] = []
  for (const command of model.commands) {
    if (command.kind !== 'branch' || !command.target) continue
    const normalized = normalizeComparableLabel(command.target)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    branches.push(command.target)
  }
  return branches
}

const readCommitIds = (model: MermaidGitGraphModel): string[] => {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const command of model.commands) {
    if (command.kind !== 'commit' || !command.commitId) continue
    const normalized = normalizeComparableLabel(command.commitId)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    ids.push(command.commitId)
  }
  return ids
}

export const appendMermaidGitGraphCommand = (code: string, kind: MermaidGitGraphAddKind): string => {
  const model = parseMermaidGitGraphModel(code)
  if (model.declarationLineIndex < 0) return model.code || 'gitGraph\n  commit id:"commit_1"'
  const tokens = readTokenSet(model)
  const branches = readBranchTargets(model)
  const commitIds = readCommitIds(model)
  let nextCommand = ''
  if (kind === 'commit') {
    nextCommand = `commit id:"${nextUniqueToken(tokens, 'commit')}"`
  } else if (kind === 'branch') {
    nextCommand = `branch ${nextUniqueToken(tokens, 'branch')}`
  } else if (kind === 'merge') {
    const targetBranch = branches[0] || ''
    if (!targetBranch) return model.code
    nextCommand = `merge ${targetBranch}`
  } else if (kind === 'cherry-pick') {
    const targetCommit = commitIds[0] || ''
    if (!targetCommit) return model.code
    nextCommand = `cherry-pick id:"${targetCommit}"`
  }
  if (!nextCommand) return model.code
  const lines = model.lines.slice()
  lines.push(`${model.commandIndent}${nextCommand}`)
  return serializeLines(lines)
}

const buildMermaidYamlLines = (code: string): string[] => {
  const bodyLines = String(code || '').replace(/\r/g, '').split('\n')
  return ['mermaid: |', ...bodyLines.map(line => `  ${line}`)]
}

const findTopLevelYamlSectionRange = (yamlLines: ReadonlyArray<string>, key: string): { start: number; end: number } | null => {
  const keyRe = new RegExp(`^${escapeRegExp(key)}\\s*:`)
  let start = -1
  for (let i = 0; i < yamlLines.length; i += 1) {
    if (keyRe.test(String(yamlLines[i] || '').trim())) {
      start = i
      break
    }
  }
  if (start < 0) return null
  let end = yamlLines.length
  for (let i = start + 1; i < yamlLines.length; i += 1) {
    const rawLine = String(yamlLines[i] || '')
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = rawLine.match(/^\s*/)?.[0]?.length || 0
    if (indent === 0 && YAML_KEY_RE.test(trimmed)) {
      end = i
      break
    }
  }
  return { start, end }
}

export const replaceMermaidGitGraphCodeInMarkdown = (markdownText: string, nextCode: string): string => {
  const text = String(markdownText || '').replace(/\r/g, '')
  const code = String(nextCode || '').replace(/\r/g, '').trim()
  const mermaidLines = buildMermaidYamlLines(code)
  const block = extractYamlFrontmatterBlock(text)
  if (!block) {
    return `---\n${mermaidLines.join('\n')}\n---\n\n${text}`
  }
  const yamlLines = String(block.yamlText || '').replace(/\r/g, '').split('\n')
  const range = findTopLevelYamlSectionRange(yamlLines, 'mermaid')
  const nextYamlLines = range
    ? [...yamlLines.slice(0, range.start), ...mermaidLines, ...yamlLines.slice(range.end)]
    : [...yamlLines.filter((line, index, arr) => !(arr.length === 1 && line.trim() === '')), ...mermaidLines]
  const nextYaml = nextYamlLines.filter((line, index, arr) => !(arr.length > 1 && index === 0 && line === '')).join('\n')
  const suffix = text.slice(block.rawBlock.length)
  return `---\n${nextYaml}\n---${suffix}`
}
