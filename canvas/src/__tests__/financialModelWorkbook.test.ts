import { strFromU8, unzipSync } from 'fflate'

import {
  parseMarkdownPipeTable,
  serializeMarkdownPipeTable,
} from '@/features/markdown/ui/markdownDataViewSerialize'
import {
  buildFinancialModelWorkbookFromMarkdown,
  FINANCIAL_MODEL_WORKBOOK_MIME_TYPE,
} from '@/features/rich-media/financialModelWorkbook'

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message)
}

const readWorkbookXml = (
  files: ReturnType<typeof unzipSync>,
  path: string,
): string => {
  const bytes = files[path]
  if (!bytes) throw new Error(`Expected XLSX part ${path}`)
  return strFromU8(bytes)
}

export function testMarkdownPipeTableParserIsBoundedAndPreservesEscapedCells() {
  const canonicalMarkdown = serializeMarkdownPipeTable({
    columns: ['Metric', 'Scenario | Case', 'Notes'],
    alignments: ['left', 'right', 'center'],
    rows: [
      ['Budget', 'RM10,000', 'Path \\ owner | approved'],
      ['Margin', '12.5%', 'Provider text'],
    ],
  }).join('\n')
  const markdown = [
    '```md',
    '| Ignored | Example |',
    '| --- | --- |',
    '| A | B |',
    '```',
    '',
    canonicalMarkdown,
  ].join('\n')

  const parsed = parseMarkdownPipeTable(markdown)
  assert(parsed, 'expected the first non-fenced canonical pipe table to parse')
  assert(
    JSON.stringify(parsed.columns) === JSON.stringify(['Metric', 'Scenario | Case', 'Notes']),
    `expected escaped header pipe to round-trip, got ${JSON.stringify(parsed.columns)}`,
  )
  assert(
    parsed.rows[0]?.[2] === 'Path \\ owner | approved',
    `expected escaped slash and pipe to round-trip, got ${JSON.stringify(parsed.rows[0]?.[2])}`,
  )
  assert(
    JSON.stringify(parsed.alignments) === JSON.stringify([null, 'right', 'center']),
    `expected delimiter alignments, got ${JSON.stringify(parsed.alignments)}`,
  )
  assert(
    parseMarkdownPipeTable(canonicalMarkdown, { maxRows: 1 }) === null,
    'expected provider-controlled tables beyond the row bound to fail closed',
  )
  assert(
    parseMarkdownPipeTable(canonicalMarkdown, { maxCellCharacters: 8 }) === null,
    'expected provider-controlled cells beyond the character bound to fail closed',
  )
}

export function testFinancialModelWorkbookBuildsTypedFormulaSafeOoxml() {
  const markdown = [
    '| Scenario | Budget | Margin | Units | Provider note |',
    '| :--- | ---: | ---: | ---: | :--- |',
    '| Base | RM10,000 | 12.5% | 1,250 | =2+2 |',
    '| Downside | (RM2,500.50) | -5% | -42.75 | +SUM(A1:A2) |',
    '| Long label designed to force a bounded column width that cannot grow without limit | $750 | 0% | 0 | @unsafe |',
    '| Formula guard | EUR100 | 1% | 1 | -cmd |',
  ].join('\n')
  const artifact = buildFinancialModelWorkbookFromMarkdown({
    markdown,
    sheetName: "Model:/Scenario[]*?'",
  })

  assert(artifact.mimeType === FINANCIAL_MODEL_WORKBOOK_MIME_TYPE, 'expected the canonical XLSX MIME type')
  assert(artifact.blob.type === FINANCIAL_MODEL_WORKBOOK_MIME_TYPE, 'expected Blob MIME to remain XLSX')
  assert(artifact.blob.size === artifact.bytes.byteLength, 'expected Blob bytes to match returned workbook bytes')
  assert(artifact.bytes[0] === 0x50 && artifact.bytes[1] === 0x4b, 'expected the XLSX ZIP signature')
  assert(artifact.sheetName === 'Model Scenario', `expected a sanitized sheet name, got ${artifact.sheetName}`)

  const files = unzipSync(artifact.bytes)
  const expectedParts = [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/app.xml',
    'docProps/core.xml',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
  ]
  expectedParts.forEach(path => assert(files[path], `expected deterministic OOXML part ${path}`))
  assert(!files['xl/sharedStrings.xml'], 'expected provider strings to remain inline rather than shared/formula cells')

  const sheetXml = readWorkbookXml(files, 'xl/worksheets/sheet1.xml')
  const stylesXml = readWorkbookXml(files, 'xl/styles.xml')
  assert(sheetXml.includes('state="frozen"'), 'expected the table header row to be frozen')
  assert(sheetXml.includes('<autoFilter ref="A1:E5"/>'), 'expected a reusable autofilter over the table range')
  assert(sheetXml.includes('showGridLines="0"'), 'expected explicit workbook structure instead of gridline styling')
  assert(/<c r="A1" s="1" t="inlineStr">/.test(sheetXml), 'expected a dedicated styled header row')
  assert(/<c r="B2" s="\d+" t="n"><v>10000<\/v><\/c>/.test(sheetXml), 'expected RM currency as a typed number')
  assert(/<c r="C2" s="\d+" t="n"><v>0\.125<\/v><\/c>/.test(sheetXml), 'expected percentage as a typed decimal')
  assert(/<c r="D2" s="\d+" t="n"><v>1250<\/v><\/c>/.test(sheetXml), 'expected grouped units as a typed number')
  assert(/<c r="B3" s="\d+" t="n"><v>-2500\.5<\/v><\/c>/.test(sheetXml), 'expected accounting currency as a typed negative number')
  assert(/<c r="C3" s="\d+" t="n"><v>-0\.05<\/v><\/c>/.test(sheetXml), 'expected negative percentages as typed decimals')
  assert(/<c r="D3" s="\d+" t="n"><v>-42\.75<\/v><\/c>/.test(sheetXml), 'expected decimal values to remain typed')
  assert(sheetXml.includes('<c r="E2" s="2" t="inlineStr"><is><t xml:space="preserve">=2+2</t>'), 'expected equals-prefixed provider text to remain inline text')
  assert(sheetXml.includes('+SUM(A1:A2)'), 'expected plus-prefixed provider text to be preserved visibly')
  assert(sheetXml.includes('@unsafe'), 'expected at-prefixed provider text to be preserved visibly')
  assert(sheetXml.includes('-cmd'), 'expected minus-prefixed provider text to be preserved visibly')
  assert(!sheetXml.includes('<f>') && !sheetXml.includes('<f '), 'provider content must never become an executable formula')
  assert(stylesXml.includes('&quot;RM&quot;#,##0'), 'expected an explicit RM currency number format')
  assert(stylesXml.includes('0.0%;[Red](0.0%);-'), 'expected an explicit percentage number format')

  const widths = [...sheetXml.matchAll(/<col [^>]*width="([0-9.]+)"/g)].map(match => Number(match[1]))
  assert(widths.length === 5, `expected one bounded width per column, got ${widths.length}`)
  assert(widths.every(width => width >= 10 && width <= 48), `expected bounded readable widths, got ${widths.join(', ')}`)
  assert(widths[0] === 48, `expected long descriptive content to cap at width 48, got ${widths[0]}`)
}

export function testFinancialModelWorkbookIsDeterministicAndRejectsMissingTables() {
  const markdown = [
    '| Metric | Value |',
    '| --- | ---: |',
    '| Budget | $1,000 |',
    '| Margin | 20% |',
  ].join('\n')
  const first = buildFinancialModelWorkbookFromMarkdown({ markdown })
  const second = buildFinancialModelWorkbookFromMarkdown({ markdown })
  assert(first.bytes.byteLength === second.bytes.byteLength, 'expected stable archive length for identical Markdown')
  assert(
    first.bytes.every((byte, index) => byte === second.bytes[index]),
    'expected stable OOXML bytes, ZIP entry ordering, metadata, and timestamps',
  )

  let missingTableError = ''
  try {
    buildFinancialModelWorkbookFromMarkdown({ markdown: 'No financial table was generated.' })
  } catch (error) {
    missingTableError = error instanceof Error ? error.message : String(error)
  }
  assert(
    missingTableError.includes('bounded pipe table'),
    `expected missing tables to fail closed, got ${JSON.stringify(missingTableError)}`,
  )
}
