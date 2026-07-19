import assert from 'node:assert/strict'
import test from 'node:test'

import { strFromU8, unzipSync } from 'fflate'

import {
  buildPresentationArtifactFromMarkdown,
  buildSpreadsheetArtifactFromMarkdown,
  MARKDOWN_PRESENTATION_MIME_TYPE,
  MARKDOWN_SPREADSHEET_MIME_TYPE,
  parseBoundedMarkdownPipeTable,
  parseBoundedMarkdownSlides,
} from '../dist/office/markdownOfficeArtifacts.js'

const readPart = (files, path) => {
  assert.ok(files[path], `expected OOXML part ${path}`)
  return strFromU8(files[path])
}

test('bounded Markdown table parser ignores fenced examples and preserves escaped cells', () => {
  const markdown = [
    '```md',
    '| Ignored | Example |',
    '| --- | --- |',
    '| A | B |',
    '```',
    '',
    '| Metric | Scenario \\| case | Notes |',
    '| :--- | ---: | :---: |',
    '| Budget | RM10,000 | Path \\\\ owner \\| approved |',
    '| Margin | 12.5% | Provider text |',
  ].join('\n')
  const parsed = parseBoundedMarkdownPipeTable(markdown)

  assert.deepEqual(parsed?.columns, ['Metric', 'Scenario | case', 'Notes'])
  assert.equal(parsed?.rows[0]?.[2], 'Path \\ owner | approved')
  assert.deepEqual(parsed?.alignments, ['left', 'right', 'center'])
  assert.equal(parseBoundedMarkdownPipeTable(markdown, { maxRows: 1 }), null)
  assert.equal(parseBoundedMarkdownPipeTable(markdown, { maxCellCharacters: 8 }), null)
})

test('spreadsheet builder emits deterministic typed and formula-safe XLSX parts', () => {
  const markdown = [
    '| Scenario | Budget | Margin | Units | Provider note |',
    '| :--- | ---: | ---: | ---: | :--- |',
    '| Base | RM10,000 | 12.5% | 1,250 | =2+2 |',
    '| Downside | (RM2,500.50) | -5% | -42.75 | +SUM(A1:A2) |',
    '| Formula guard | EUR100 | 1% | 1 | @unsafe |',
  ].join('\n')
  const first = buildSpreadsheetArtifactFromMarkdown({ markdown, sheetName: "Model:/Scenario[]*?'" })
  const second = buildSpreadsheetArtifactFromMarkdown({ markdown, sheetName: "Model:/Scenario[]*?'" })

  assert.equal(first.mimeType, MARKDOWN_SPREADSHEET_MIME_TYPE)
  assert.equal(first.sheetName, 'Model Scenario')
  assert.deepEqual(first.bytes, second.bytes)
  assert.deepEqual([...first.bytes.slice(0, 2)], [0x50, 0x4b])

  const files = unzipSync(first.bytes)
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
  expectedParts.forEach(path => assert.ok(files[path], `expected XLSX part ${path}`))
  assert.equal(files['xl/sharedStrings.xml'], undefined)

  const sheetXml = readPart(files, 'xl/worksheets/sheet1.xml')
  const stylesXml = readPart(files, 'xl/styles.xml')
  assert.match(sheetXml, /state="frozen"/)
  assert.match(sheetXml, /<autoFilter ref="A1:E4"\/>/)
  assert.match(sheetXml, /<c r="B2" s="\d+" t="n"><v>10000<\/v><\/c>/)
  assert.match(sheetXml, /<c r="C2" s="\d+" t="n"><v>0\.125<\/v><\/c>/)
  assert.match(sheetXml, /<c r="B3" s="\d+" t="n"><v>-2500\.5<\/v><\/c>/)
  assert.match(sheetXml, /<c r="E2" s="2" t="inlineStr"><is><t xml:space="preserve">=2\+2<\/t>/)
  assert.match(sheetXml, /\+SUM\(A1:A2\)/)
  assert.match(sheetXml, /@unsafe/)
  assert.doesNotMatch(sheetXml, /<f(?:\s|>)/)
  assert.match(stylesXml, /&quot;RM&quot;#,##0/)
  assert.match(stylesXml, /0\.0%;\[Red\]\(0\.0%\);-/)
})

test('bounded slide parser supports frontmatter, headings, separators, and bullets', () => {
  const markdown = [
    '---',
    'title: Ignored metadata',
    '---',
    '# Strategy & proof',
    '- One owner',
    '* Deterministic output',
    '---',
    '## Runtime acceptance',
    '1. Create',
    '2. Verify',
  ].join('\n')
  const slides = parseBoundedMarkdownSlides(markdown)

  assert.deepEqual(slides, [
    { title: 'Strategy & proof', bodyLines: ['• One owner', '• Deterministic output'] },
    { title: 'Runtime acceptance', bodyLines: ['• Create', '• Verify'] },
  ])
  assert.equal(parseBoundedMarkdownSlides(markdown, { maxSlides: 1 }), null)
  assert.equal(parseBoundedMarkdownSlides('# A\n' + 'x'.repeat(32), { maxLineCharacters: 16 }), null)
  assert.deepEqual(
    parseBoundedMarkdownSlides('---\n# First\nBody\n---\n# Second\nBody'),
    [
      { title: 'First', bodyLines: ['Body'] },
      { title: 'Second', bodyLines: ['Body'] },
    ],
    'a leading slide separator must not be mistaken for YAML frontmatter',
  )
})

test('presentation builder emits deterministic relationship-complete PPTX parts', () => {
  const markdown = [
    '# Strategy & proof',
    '- One canonical owner',
    '- Deterministic native output',
    '---',
    '## Runtime & acceptance',
    'Create, verify, and retain the receipt.',
  ].join('\n')
  const first = buildPresentationArtifactFromMarkdown({ markdown, title: 'Plan & Proof' })
  const second = buildPresentationArtifactFromMarkdown({ markdown, title: 'Plan & Proof' })

  assert.equal(first.mimeType, MARKDOWN_PRESENTATION_MIME_TYPE)
  assert.equal(first.title, 'Plan & Proof')
  assert.equal(first.slides.length, 2)
  assert.deepEqual(first.bytes, second.bytes)
  assert.deepEqual([...first.bytes.slice(0, 2)], [0x50, 0x4b])

  const files = unzipSync(first.bytes)
  const expectedParts = [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/app.xml',
    'docProps/core.xml',
    'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels',
    'ppt/slideMasters/slideMaster1.xml',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    'ppt/slideLayouts/slideLayout1.xml',
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    'ppt/theme/theme1.xml',
    'ppt/presProps.xml',
    'ppt/viewProps.xml',
    'ppt/tableStyles.xml',
    'ppt/slides/slide1.xml',
    'ppt/slides/_rels/slide1.xml.rels',
    'ppt/slides/slide2.xml',
    'ppt/slides/_rels/slide2.xml.rels',
  ]
  expectedParts.forEach(path => assert.ok(files[path], `expected PPTX part ${path}`))

  const presentationXml = readPart(files, 'ppt/presentation.xml')
  const relationshipsXml = readPart(files, 'ppt/_rels/presentation.xml.rels')
  const secondSlideXml = readPart(files, 'ppt/slides/slide2.xml')
  const coreXml = readPart(files, 'docProps/core.xml')
  assert.equal((presentationXml.match(/<p:sldId /g) || []).length, 2)
  assert.equal((relationshipsXml.match(/relationships\/slide"/g) || []).length, 2)
  assert.match(secondSlideXml, /Runtime &amp; acceptance/)
  assert.match(coreXml, /Plan &amp; Proof/)
})

test('builders fail closed when their bounded Markdown structure is missing', () => {
  assert.throws(
    () => buildSpreadsheetArtifactFromMarkdown({ markdown: 'No table.' }),
    /bounded pipe table/,
  )
  assert.throws(
    () => buildPresentationArtifactFromMarkdown({ markdown: '' }),
    /bounded slides/,
  )
})
