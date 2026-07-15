import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'

export type FeishuBaseSourceField = {
  id: string
  name: string
  type?: string | null
  isPrimary?: boolean
}

export type FeishuBaseSourceRecord = {
  id: string
  title?: string | null
  fields: Record<string, unknown>
}

export type FeishuBaseSourceSelection = {
  baseToken: string
  tableId: string
  viewId?: string | null
  baseTitle?: string | null
  tableName?: string | null
  viewName?: string | null
  sourceUrl?: string | null
}

export type FeishuBaseSourceAdapterInput = {
  selection: FeishuBaseSourceSelection
  fields?: FeishuBaseSourceField[] | null
  records?: FeishuBaseSourceRecord[] | null
}

export type FeishuBaseSourceDocument = {
  name: string
  text: string
  sourceUrl: string | null
  fieldCount: number
  recordCount: number
}

export type FeishuBaseSourceAdapterResult =
  | {
      ok: true
      document: FeishuBaseSourceDocument
      warnings: string[]
    }
  | {
      ok: false
      error: string
      warnings: string[]
    }

const normalizeString = (value: unknown): string => String(value || '').trim()

const yamlQuote = (value: string): string => JSON.stringify(String(value || ''))

const sanitizeFileStem = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const redactIdentifier = (value: string, prefix: string): string => {
  const text = normalizeString(value)
  if (!text) return ''
  if (text.length <= 10) return `${prefix}:${text}`
  return `${prefix}:${text.slice(0, 6)}...${text.slice(-4)}`
}

const readUrlOrigin = (value: string): string => {
  const text = normalizeString(value)
  if (!text) return ''
  try {
    return new URL(text).origin
  } catch {
    return ''
  }
}

const summarizeValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'string') {
    const compact = value.replace(/\s+/g, ' ').trim()
    if (!compact) return '""'
    return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const compactJson = JSON.stringify(value)
    if (typeof compactJson !== 'string') return 'null'
    return compactJson.length > 220 ? `${compactJson.slice(0, 217)}...` : compactJson
  } catch {
    return '[unserializable]'
  }
}

const readRecordHeading = (record: FeishuBaseSourceRecord, fields: FeishuBaseSourceField[]): string => {
  const explicit = normalizeString(record.title)
  if (explicit) return explicit
  const primaryField = fields.find(field => field.isPrimary === true)
  if (primaryField) {
    const primaryValue = summarizeValue(record.fields?.[primaryField.name])
    if (primaryValue && primaryValue !== 'null' && primaryValue !== '""') return primaryValue
  }
  for (const [key, value] of Object.entries(record.fields || {})) {
    const summarized = summarizeValue(value)
    if (summarized && summarized !== 'null' && summarized !== '""') return `${key}: ${summarized}`
  }
  return 'Untitled record'
}

const buildFrontmatter = (args: {
  selection: FeishuBaseSourceSelection
  fieldCount: number
  recordCount: number
  title: string
}): string => {
  const lines = [
    '---',
    `title: ${yamlQuote(args.title)}`,
    'doc_type: "feishu_base_source"',
    'lang: "en-US"',
    `kgFeishuBaseBaseRef: ${yamlQuote(redactIdentifier(args.selection.baseToken, 'base'))}`,
    `kgFeishuBaseTableRef: ${yamlQuote(redactIdentifier(args.selection.tableId, 'table'))}`,
    `kgFeishuBaseRecordCount: ${args.recordCount}`,
    `kgFeishuBaseFieldCount: ${args.fieldCount}`,
    'kgFeishuBaseSourceKind: "records"',
  ]
  const viewId = normalizeString(args.selection.viewId)
  const baseTitle = normalizeString(args.selection.baseTitle)
  const tableName = normalizeString(args.selection.tableName)
  const viewName = normalizeString(args.selection.viewName)
  const sourceUrl = normalizeString(args.selection.sourceUrl)
  if (viewId) lines.push(`kgFeishuBaseViewRef: ${yamlQuote(redactIdentifier(viewId, 'view'))}`)
  if (baseTitle) lines.push(`kgFeishuBaseBaseTitle: ${yamlQuote(baseTitle)}`)
  if (tableName) lines.push(`kgFeishuBaseTableName: ${yamlQuote(tableName)}`)
  if (viewName) lines.push(`kgFeishuBaseViewName: ${yamlQuote(viewName)}`)
  const sourceUrlOrigin = readUrlOrigin(sourceUrl)
  if (sourceUrlOrigin) lines.push(`kgFeishuBaseUrlOrigin: ${yamlQuote(sourceUrlOrigin)}`)
  lines.push('---', '')
  return lines.join('\n')
}

const buildSummarySection = (args: {
  selection: FeishuBaseSourceSelection
  fieldCount: number
  recordCount: number
}): string => {
  const lines = [
    '# Feishu Base Source',
    '',
    '## Summary',
    '',
    `- Base: ${normalizeString(args.selection.baseTitle) || 'Untitled Base'}`,
    `- Table: ${normalizeString(args.selection.tableName) || redactIdentifier(args.selection.tableId, 'table')}`,
    `- View: ${normalizeString(args.selection.viewName) || (normalizeString(args.selection.viewId) ? redactIdentifier(normalizeString(args.selection.viewId), 'view') : 'Not specified')}`,
    `- Record count: ${args.recordCount}`,
    `- Field count: ${args.fieldCount}`,
    '- Validation path: route the resulting markdown through the existing source-files and markdown validation owners before graph application.',
    '',
  ]
  return lines.join('\n')
}

const buildFieldSchemaSection = (fields: FeishuBaseSourceField[]): string => {
  const lines = ['## Field Schema', '']
  if (!fields.length) {
    lines.push('No field schema was provided for this snapshot.', '')
    return lines.join('\n')
  }
  lines.push(...serializeMarkdownPipeTable({
    columns: ['Field', 'Type', 'Role'],
    rows: fields.map(field => [
      field.name,
      normalizeString(field.type) || 'unknown',
      field.isPrimary ? 'primary' : 'standard',
    ]),
  }))
  lines.push('')
  return lines.join('\n')
}

const buildRecordsSection = (records: FeishuBaseSourceRecord[], fields: FeishuBaseSourceField[]): string => {
  const lines = ['## Records', '']
  if (!records.length) {
    lines.push('No records were provided in this snapshot.', '')
    return lines.join('\n')
  }
  records.forEach((record, index) => {
    lines.push(`### ${index + 1}. ${readRecordHeading(record, fields)}`, '')
    lines.push(`- \`record_ref\`: ${redactIdentifier(record.id, 'record')}`)
    const fieldEntries = Object.entries(record.fields || {})
    if (!fieldEntries.length) {
      lines.push('- No field values were provided.', '')
      return
    }
    for (const [fieldName, rawValue] of fieldEntries) {
      lines.push(`- \`${fieldName}\`: ${summarizeValue(rawValue)}`)
    }
    lines.push('')
  })
  return lines.join('\n')
}

const buildDocumentName = (selection: FeishuBaseSourceSelection): string => {
  const parts = [
    sanitizeFileStem(normalizeString(selection.baseTitle)),
    sanitizeFileStem(normalizeString(selection.tableName)),
  ].filter(Boolean)
  return `${parts.length ? parts.join('-') : 'feishu-base-source'}.md`
}

export function adaptFeishuBaseRecordsToSourceDocument(
  input: FeishuBaseSourceAdapterInput,
): FeishuBaseSourceAdapterResult {
  const selection = input?.selection
  const baseToken = normalizeString(selection?.baseToken)
  const tableId = normalizeString(selection?.tableId)
  if (!baseToken) return { ok: false, error: 'Missing Feishu Base token.', warnings: [] }
  if (!tableId) return { ok: false, error: 'Missing Feishu Base table id.', warnings: [] }

  const fields = Array.isArray(input.fields) ? input.fields.filter(Boolean) : []
  const records = Array.isArray(input.records) ? input.records.filter(Boolean) : []
  const warnings: string[] = []
  if (!fields.length) warnings.push('No field schema was supplied for this Feishu Base snapshot.')
  if (!records.length) warnings.push('No records were supplied for this Feishu Base snapshot.')

  const titleParts = [
    normalizeString(selection.baseTitle) || 'Feishu Base',
    normalizeString(selection.tableName) || 'Source Snapshot',
  ].filter(Boolean)
  const title = titleParts.join(' - ')

  const rawText = [
    buildFrontmatter({
      selection,
      fieldCount: fields.length,
      recordCount: records.length,
      title,
    }),
    buildSummarySection({
      selection,
      fieldCount: fields.length,
      recordCount: records.length,
    }),
    buildFieldSchemaSection(fields),
    buildRecordsSection(records, fields),
  ].join('\n')

  const sourceUrl = normalizeString(selection.sourceUrl) || null
  const sanitized = sanitizeImportedMarkdownText(rawText, sourceUrl ? { sourceUrl } : undefined)
  return {
    ok: true,
    warnings,
    document: {
      name: buildDocumentName(selection),
      text: sanitized.text,
      sourceUrl,
      fieldCount: fields.length,
      recordCount: records.length,
    },
  }
}
