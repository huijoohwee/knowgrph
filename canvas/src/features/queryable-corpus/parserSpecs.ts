import type { ParserSpec } from '@/features/parsers/types'
import { toParserId } from '@/features/parsers/types'
import {
  isCorpusSourceUnitMarkdown,
  parseCorpusCodeGraph,
  parseCorpusScriptGraph,
  parseCorpusSourceUnitMarkdown,
  parseCorpusSqlGraph,
} from '@/features/queryable-corpus/corpusGraph'
import { parseCorpusConfigGraph } from '@/features/queryable-corpus/corpusConfigGraph'

const lowerName = (name: string): string => String(name || '').trim().toLowerCase()

const codeFilePattern = /\.(ts|tsx|js|jsx|mjs|cjs|go|rs|java|c|cc|cpp|cs|kt|rb|php)$/i
const scriptFilePattern = /\.(sh|bash|zsh|ps1|r)$/i
const documentFilePattern = /\.(md|markdown|mdx|mmd|txt|html|htm|yaml|yml|json|jsonld|geojson|csv|svg)$/i
const configFilePattern = /(?:^|\/)(?:dockerfile|package\.json|wrangler\.(?:toml|json|jsonc)|docker-compose\.ya?ml|compose\.ya?ml|[^/]+\.(?:toml|tf|tfvars))$/i

export const corpusSourceUnitSpec: ParserSpec = {
  id: toParserId('corpus-source-unit'),
  name: 'Corpus Source Unit',
  match: (_name, text) => isCorpusSourceUnitMarkdown(text),
  parse: (name, text) => parseCorpusSourceUnitMarkdown(name, text) || {
    graphData: { context: 'queryable-corpus', type: 'Graph', nodes: [], edges: [] },
    warnings: ['Corpus source unit frontmatter was not parseable'],
  },
}

export const corpusSqlSpec: ParserSpec = {
  id: toParserId('corpus-sql'),
  name: 'Corpus SQL Schema',
  match: (name, text) => {
    const lower = lowerName(name)
    if (lower.endsWith('.sql')) return true
    if (documentFilePattern.test(lower)) return false
    return /\bcreate\s+table\b/i.test(String(text || '')) && /\breferences\b|\bprimary\s+key\b|\bforeign\s+key\b/i.test(String(text || ''))
  },
  parse: parseCorpusSqlGraph,
}

export const corpusScriptSpec: ParserSpec = {
  id: toParserId('corpus-script'),
  name: 'Corpus Script',
  match: (name, text) => {
    const lower = lowerName(name)
    if (scriptFilePattern.test(lower)) return true
    if (documentFilePattern.test(lower)) return false
    const raw = String(text || '')
    return /^#!.*\b(?:bash|zsh|sh|Rscript)\b/m.test(raw)
  },
  parse: parseCorpusScriptGraph,
}

export const corpusCodeSpec: ParserSpec = {
  id: toParserId('corpus-code'),
  name: 'Corpus Code',
  match: (name, text) => {
    const lower = lowerName(name)
    if (codeFilePattern.test(lower)) return true
    if (documentFilePattern.test(lower)) return false
    const raw = String(text || '')
    return /\b(import|export|class|function|def|func|use)\b/.test(raw) && raw.length < 2_000_000
  },
  parse: parseCorpusCodeGraph,
}

export const corpusConfigSpec: ParserSpec = {
  id: toParserId('corpus-config'),
  name: 'Corpus Infrastructure Config',
  match: (name) => configFilePattern.test(lowerName(name)),
  parse: parseCorpusConfigGraph,
}

export const queryableCorpusParsers: ParserSpec[] = [
  corpusSourceUnitSpec,
  corpusSqlSpec,
  corpusScriptSpec,
  corpusCodeSpec,
  corpusConfigSpec,
]
