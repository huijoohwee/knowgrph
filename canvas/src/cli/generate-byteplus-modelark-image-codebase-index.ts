import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BYTEPLUS_IMAGE_GENERATION_DOC_ROWS,
  type BytePlusImageApiDocRow,
} from '../features/integrations/byteplusImageGenerationSsot'
import { CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH } from '../lib/chatEndpoint'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..')

const OUTPUT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'documents',
  'api-reference',
  'api-reference-codebase-index_202604261230',
  'knowgrph-byteplus-modelark-image-generation-api-reference-codebase-index.md',
)

const CONFIG_KEYS = new Set(['auth_mode', 'api_key', 'docs_url', 'endpoint'])
const REQUIRED_KEYS = new Set(['model', 'prompt'])

function escapeMarkdownCell(value: string): string {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function normalizeScalar(value: string | number | boolean | null | undefined): string {
  if (typeof value === 'undefined') return ''
  if (value === null) return 'null'
  const text = String(value).trim()
  if (!text) return ''
  return text === '—' ? '-' : text
}

function trimTrailingSentencePunctuation(value: string): string {
  return String(value || '').trim().replace(/[.;\s]+$/g, '')
}

function buildValueDescription(row: BytePlusImageApiDocRow): string {
  const parts: string[] = []
  if (typeof row.tooltipDefaultValue !== 'undefined') parts.push(`Default: ${normalizeScalar(row.tooltipDefaultValue)}`)
  if (typeof row.tooltipMin !== 'undefined') parts.push(`Min: ${normalizeScalar(row.tooltipMin)}`)
  if (typeof row.tooltipMax !== 'undefined') parts.push(`Max: ${normalizeScalar(row.tooltipMax)}`)
  if (typeof row.tooltipInterval !== 'undefined') parts.push(`Interval: ${normalizeScalar(row.tooltipInterval)}`)
  if (row.tooltipExpansionNote) parts.push(trimTrailingSentencePunctuation(row.tooltipExpansionNote))
  if (row.tooltipContractionNote) parts.push(trimTrailingSentencePunctuation(row.tooltipContractionNote))
  if (row.tooltipImpact) parts.push(`Impact: ${trimTrailingSentencePunctuation(row.tooltipImpact)}`)
  return parts.join('; ')
}

function resolvePattern(typeLabel: string): string {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (!normalized) return '—'
  if (normalized.includes('object') && normalized.includes('[]')) return 'array<union>'
  if (normalized.includes('array')) return 'array<union>'
  if (normalized.includes('|')) return 'union'
  if (normalized.includes('object')) return 'object'
  return 'scalar'
}

function formatList(values: string[] | undefined): string {
  return (values || []).map(value => String(value || '').trim()).filter(Boolean).join('; ')
}

function buildRow(row: BytePlusImageApiDocRow): string {
  const isConfig = CONFIG_KEYS.has(row.key)
  const endpoint = isConfig ? 'ALL' : `POST ${CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH}`
  const kind = isConfig ? 'config' : 'param'
  const required = REQUIRED_KEYS.has(row.key) ? 'yes' : 'no'
  const direction = 'in'
  const actor = isConfig ? 'Operator' : 'Caller'
  const seqNote = isConfig ? '—' : `POST ${CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH}`
  const location = isConfig ? '—' : 'body'
  const scope = '—'
  const pattern = resolvePattern(row.typeLabel)
  const keyDescription = row.responsibility
  const valueDescription = buildValueDescription(row)

  const cells = [
    endpoint,
    kind,
    row.key,
    row.typeLabel,
    row.value,
    required,
    direction,
    actor,
    seqNote,
    location,
    scope,
    pattern,
    keyDescription,
    valueDescription,
    formatList(row.module),
    formatList(row.className),
    formatList(row.functionName),
  ].map(escapeMarkdownCell)
  return `| ${cells.join(' | ')} |`
}

function buildMarkdown(): string {
  const lines = [
    '## Table',
    '',
    '| endpoint | kind | key | type | value | required | direction | actor | seq-note | location | scope | pattern | key-description | value-description | module | class | function |',
    '|----------|------|-----|------|-------|----------|-----------|-------|----------|----------|-------|---------|-----------------|-------------------|--------|-------|----------|',
    ...BYTEPLUS_IMAGE_GENERATION_DOC_ROWS.map(buildRow),
    '',
  ]
  return lines.join('\n')
}

function main(): void {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, buildMarkdown(), 'utf8')
  process.stdout.write(`${OUTPUT_PATH}\n`)
}

main()

