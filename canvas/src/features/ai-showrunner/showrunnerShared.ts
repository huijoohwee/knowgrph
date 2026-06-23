import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { extractYamlFrontmatterBlock } from '@/lib/markdown/frontmatter'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashSignatureParts } from '@/lib/hash/signature'
import type { ShowrunnerSourceFileStore, SourceFileRecord } from './showrunnerTypes'

export const normalizeShowrunnerString = (value: unknown): string => String(value || '').trim()

export const isShowrunnerRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const normalizeShowrunnerStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(normalizeShowrunnerString).filter(Boolean)))
    : []

export const readShowrunnerNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const readShowrunnerPositiveInteger = (value: unknown, fallback: number): number => {
  const n = Math.floor(readShowrunnerNumber(value, fallback))
  return n > 0 ? n : fallback
}

export const readShowrunnerFrontmatter = (markdownText: string): { meta: Record<string, unknown>; body: string; warnings: string[] } => {
  const block = extractYamlFrontmatterBlock(markdownText)
  if (!block) return { meta: {}, body: String(markdownText || ''), warnings: ['Missing YAML frontmatter block.'] }
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(block.rawBlock))
  return {
    meta: parsed.meta || {},
    body: block.bodyText,
    warnings: parsed.warnings || [],
  }
}

export const yamlScalar = (value: unknown): string => JSON.stringify(value ?? '')

export const yamlFlow = (value: unknown): string => JSON.stringify(value ?? null)

export const buildShowrunnerSemanticKey = (scope: string, value: unknown): string =>
  buildScopedGraphSemanticKey(scope, { graphSemanticKey: normalizeShowrunnerString(value) }) || normalizeShowrunnerString(value)

export const deriveShowrunnerRunKey = (runId: string): string =>
  buildShowrunnerSemanticKey('showrunner-run', runId)

export const deriveShowrunnerContentHash = (content: unknown): string =>
  hashSignatureParts(['showrunner-content', normalizeShowrunnerString(content)])

export const normalizeShowrunnerPathPart = (value: unknown): string => {
  const raw = normalizeShowrunnerString(value)
  const semantic = buildShowrunnerSemanticKey('showrunner-path-part', raw)
  return semantic || 'showrunner'
}

export const showrunnerRunRootPath = (runId: string): string => `showrunner/runs/${deriveShowrunnerRunKey(runId)}`
export const showrunnerBriefPath = (runId: string): string => `showrunner/briefs/${deriveShowrunnerRunKey(runId)}/brief.md`
export const showrunnerRunStatePath = (runId: string): string => `${showrunnerRunRootPath(runId)}/state.json`
export const showrunnerCostLogPath = (runId: string): string => `${showrunnerRunRootPath(runId)}/cost-log.jsonl`
export const showrunnerStateEntryPath = (runId: string, turnIndex: number, role: string): string =>
  `${showrunnerRunRootPath(runId)}/state/${String(Math.max(0, Math.floor(turnIndex))).padStart(6, '0')}-${normalizeShowrunnerPathPart(role)}.md`

export const createInMemoryShowrunnerSourceFileStore = (): ShowrunnerSourceFileStore => {
  const files = new Map<string, SourceFileRecord>()
  return {
    async writeSourceFile(path: string, content: string) {
      const safePath = normalizeShowrunnerString(path)
      const record: SourceFileRecord = {
        path: safePath,
        content: String(content || ''),
        content_hash: deriveShowrunnerContentHash(content),
        updated_at_iso: new Date().toISOString(),
      }
      files.set(safePath, record)
      return record
    },
    async readSourceFile(path: string) {
      return files.get(normalizeShowrunnerString(path))?.content ?? null
    },
    async listSourceFiles(prefix: string) {
      const normalizedPrefix = normalizeShowrunnerString(prefix)
      return Array.from(files.values())
        .filter(record => record.path.startsWith(normalizedPrefix))
        .sort((left, right) => left.path.localeCompare(right.path))
    },
  }
}
