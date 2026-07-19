import { strToU8, zipSync } from 'fflate'

import {
  parseMarkdownPipeTable,
  type ParsedMarkdownPipeTable,
} from '@/features/markdown/ui/markdownDataViewSerialize'

export const FINANCIAL_MODEL_WORKBOOK_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const

export type FinancialModelWorkbookInput = {
  markdown: string
  sheetName?: string
}

export type FinancialModelWorkbookArtifact = {
  bytes: Uint8Array<ArrayBuffer>
  blob: Blob
  mimeType: typeof FINANCIAL_MODEL_WORKBOOK_MIME_TYPE
  sheetName: string
  table: ParsedMarkdownPipeTable
}

type CurrencyDefinition = {
  aliases: readonly string[]
  label: string
  defaultDecimalPlaces: number
}

type WorkbookCell =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number; numberFormat: string }

const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0)
const FIXED_DOCUMENT_TIMESTAMP = '2000-01-01T00:00:00Z'
const DEFAULT_SHEET_NAME = 'Financial Model'
const MAX_COLUMN_WIDTH = 48
const MAX_FORMAT_DECIMAL_PLACES = 4

const CURRENCIES: readonly CurrencyDefinition[] = [
  { aliases: ['HK$', 'HKD'], label: 'HK$', defaultDecimalPlaces: 0 },
  { aliases: ['US$', 'USD'], label: '$', defaultDecimalPlaces: 0 },
  { aliases: ['S$', 'SGD'], label: 'S$', defaultDecimalPlaces: 0 },
  { aliases: ['A$', 'AUD'], label: 'A$', defaultDecimalPlaces: 0 },
  { aliases: ['C$', 'CAD'], label: 'C$', defaultDecimalPlaces: 0 },
  { aliases: ['RM', 'MYR'], label: 'RM', defaultDecimalPlaces: 0 },
  { aliases: ['EUR', '€'], label: '€', defaultDecimalPlaces: 0 },
  { aliases: ['GBP', '£'], label: '£', defaultDecimalPlaces: 0 },
  { aliases: ['JPY', '¥'], label: '¥', defaultDecimalPlaces: 0 },
  { aliases: ['CNY', 'RMB'], label: 'CNY ', defaultDecimalPlaces: 0 },
  { aliases: ['$'], label: '$', defaultDecimalPlaces: 0 },
]

const escapeXml = (value: unknown): string => {
  const validXml = Array.from(String(value ?? ''), character => {
    const codePoint = character.codePointAt(0) || 0
    const valid = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    return valid ? character : '\ufffd'
  }).join('')
  return validXml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const sanitizeSheetName = (value: unknown): string => {
  const cleaned = String(value ?? '')
    .replace(/[\\/*?:\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .slice(0, 31)
    .trim()
  return cleaned || DEFAULT_SHEET_NAME
}

const toColumnName = (zeroBasedIndex: number): string => {
  let value = zeroBasedIndex + 1
  let output = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    output = String.fromCharCode(65 + remainder) + output
    value = Math.floor((value - 1) / 26)
  }
  return output
}

const unwrapAccountingNegative = (raw: string): { value: string; negative: boolean } => {
  const trimmed = raw.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return { value: trimmed.slice(1, -1).trim(), negative: true }
  }
  return { value: trimmed, negative: false }
}

const parseNumberLiteral = (raw: string): { value: number; decimalPlaces: number } | null => {
  const normalized = raw.trim()
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized.replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  const decimalPlaces = Math.min(MAX_FORMAT_DECIMAL_PLACES, normalized.split('.')[1]?.length || 0)
  return { value, decimalPlaces }
}

const applyAccountingSign = (value: number, negative: boolean): number => {
  if (!negative) return value
  return value === 0 ? 0 : -Math.abs(value)
}

const buildNumberFormat = (decimalPlaces: number, prefix = ''): string => {
  const decimalPattern = decimalPlaces > 0 ? `.${'0'.repeat(decimalPlaces)}` : ''
  const positive = `${prefix}#,##0${decimalPattern}`
  return `${positive};[Red](${positive});-`
}

const readCurrencyCell = (raw: string): WorkbookCell | null => {
  const accounting = unwrapAccountingNegative(raw)
  for (const currency of CURRENCIES) {
    for (const alias of currency.aliases) {
      const startsWithAlias = accounting.value.toUpperCase().startsWith(alias.toUpperCase())
      const endsWithAlias = accounting.value.toUpperCase().endsWith(alias.toUpperCase())
      if (!startsWithAlias && !endsWithAlias) continue
      const amountText = startsWithAlias
        ? accounting.value.slice(alias.length).trim()
        : accounting.value.slice(0, accounting.value.length - alias.length).trim()
      const numeric = parseNumberLiteral(amountText)
      if (!numeric) continue
      const decimalPlaces = Math.max(currency.defaultDecimalPlaces, numeric.decimalPlaces)
      return {
        kind: 'number',
        value: applyAccountingSign(numeric.value, accounting.negative),
        numberFormat: buildNumberFormat(decimalPlaces, `"${currency.label}"`),
      }
    }
  }
  return null
}

const readPercentCell = (raw: string): WorkbookCell | null => {
  const accounting = unwrapAccountingNegative(raw)
  if (!accounting.value.endsWith('%')) return null
  const numeric = parseNumberLiteral(accounting.value.slice(0, -1))
  if (!numeric) return null
  return {
    kind: 'number',
    value: applyAccountingSign(numeric.value / 100, accounting.negative),
    numberFormat: '0.0%;[Red](0.0%);-',
  }
}

const readNumberCell = (raw: string): WorkbookCell | null => {
  const accounting = unwrapAccountingNegative(raw)
  const numeric = parseNumberLiteral(accounting.value)
  if (!numeric) return null
  return {
    kind: 'number',
    value: applyAccountingSign(numeric.value, accounting.negative),
    numberFormat: buildNumberFormat(numeric.decimalPlaces),
  }
}

const toWorkbookCell = (raw: string): WorkbookCell =>
  readCurrencyCell(raw)
  || readPercentCell(raw)
  || readNumberCell(raw)
  || { kind: 'text', value: raw }

const collectNumberFormats = (rows: readonly (readonly WorkbookCell[])[]): string[] => {
  const formats = new Set<string>()
  rows.forEach(row => row.forEach(cell => {
    if (cell.kind === 'number') formats.add(cell.numberFormat)
  }))
  return [...formats]
}

const buildStylesXml = (numberFormats: readonly string[]): string => {
  const formatIdByCode = new Map(numberFormats.map((format, index) => [format, 164 + index]))
  const numFmts = numberFormats.length > 0
    ? `<numFmts count="${numberFormats.length}">${numberFormats.map(format =>
      `<numFmt numFmtId="${formatIdByCode.get(format)}" formatCode="${escapeXml(format)}"/>`,
    ).join('')}</numFmts>`
    : ''
  const numericStyles = numberFormats.map(format =>
    `<xf numFmtId="${formatIdByCode.get(format)}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts}<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFB4C7E7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${3 + numberFormats.length}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>${numericStyles}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`
}

const buildInlineStringCell = (reference: string, value: string, styleId: number): string =>
  `<c r="${reference}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`

const buildNumberCell = (reference: string, value: number, styleId: number): string =>
  `<c r="${reference}" s="${styleId}" t="n"><v>${Object.is(value, -0) ? '0' : String(value)}</v></c>`

const buildColumnWidths = (table: ParsedMarkdownPipeTable): number[] =>
  table.columns.map((column, columnIndex) => {
    const values = [column, ...table.rows.map(row => row[columnIndex] || '')]
    const visibleLength = Math.max(...values.map(value => Array.from(value).length))
    return Math.min(MAX_COLUMN_WIDTH, Math.max(10, visibleLength + 2))
  })

const buildWorksheetXml = (
  table: ParsedMarkdownPipeTable,
  rows: readonly (readonly WorkbookCell[])[],
  formatStyleIds: ReadonlyMap<string, number>,
): string => {
  const finalColumn = toColumnName(table.columns.length - 1)
  const finalRow = table.rows.length + 1
  const range = `A1:${finalColumn}${finalRow}`
  const columnXml = buildColumnWidths(table).map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
  ).join('')
  const headerCells = table.columns.map((column, index) =>
    buildInlineStringCell(`${toColumnName(index)}1`, column, 1),
  ).join('')
  const bodyRows = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2
    const cells = row.map((cell, columnIndex) => {
      const reference = `${toColumnName(columnIndex)}${excelRow}`
      if (cell.kind === 'text') return buildInlineStringCell(reference, cell.value, 2)
      const styleId = formatStyleIds.get(cell.numberFormat)
      if (styleId == null) throw new Error(`Missing XLSX number style for ${cell.numberFormat}`)
      return buildNumberCell(reference, cell.value, styleId)
    }).join('')
    return `<row r="${excelRow}" spans="1:${table.columns.length}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columnXml}</cols><sheetData><row r="1" spans="1:${table.columns.length}" ht="24" customHeight="1">${headerCells}</row>${bodyRows}</sheetData><autoFilter ref="${range}"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
}

const buildWorkbookParts = (
  table: ParsedMarkdownPipeTable,
  sheetName: string,
): Record<string, Uint8Array<ArrayBuffer>> => {
  const rows = table.rows.map(row => row.map(toWorkbookCell))
  const numberFormats = collectNumberFormats(rows)
  const formatStyleIds = new Map(numberFormats.map((format, index) => [format, 3 + index]))
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>knowgrph</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapeXml(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>1.0</AppVersion></Properties>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>knowgrph</dc:creator><cp:lastModifiedBy>knowgrph</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${FIXED_DOCUMENT_TIMESTAMP}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${FIXED_DOCUMENT_TIMESTAMP}</dcterms:modified></cp:coreProperties>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" state="visible" r:id="rId1"/></sheets><calcPr calcId="0"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': buildStylesXml(numberFormats),
    'xl/worksheets/sheet1.xml': buildWorksheetXml(table, rows, formatStyleIds),
  }
  return Object.fromEntries(Object.entries(parts).map(([path, xml]) => [path, strToU8(xml)]))
}

/** Build a deterministic OOXML companion while keeping Markdown authoritative. */
export const buildFinancialModelWorkbookFromMarkdown = (
  input: FinancialModelWorkbookInput,
): FinancialModelWorkbookArtifact => {
  const table = parseMarkdownPipeTable(input.markdown)
  if (!table) throw new Error('Financial model Markdown must contain one bounded pipe table.')
  const sheetName = sanitizeSheetName(input.sheetName)
  const bytes = zipSync(buildWorkbookParts(table, sheetName), {
    level: 6,
    mtime: FIXED_ZIP_DATE,
  })
  return {
    bytes,
    blob: new Blob([bytes], { type: FINANCIAL_MODEL_WORKBOOK_MIME_TYPE }),
    mimeType: FINANCIAL_MODEL_WORKBOOK_MIME_TYPE,
    sheetName,
    table,
  }
}
