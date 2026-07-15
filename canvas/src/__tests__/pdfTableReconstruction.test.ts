import { buildMarkdownForPage } from '@/lib/pdf/native/pdfMarkdown'
import type { TextFragment } from '@/lib/pdf/native/types'

function frag(x: number, y: number, text: string, fontSize = 12): TextFragment {
  return { x, y, text, fontSize, fontKey: 'F1' }
}

export async function testPdfTableReconstructionBuildsMarkdownPipeTable() {
  const y0 = 700
  const rowGap = 18
  const colXs = [60, 220, 420]
  const rows = [
    ['Name', 'Qty', 'Price'],
    ['Apple', '2', '$3'],
    ['Banana', '10', '$1'],
    ['Cherry', '1', '$9'],
  ]
  const fragments: TextFragment[] = []
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < colXs.length; c += 1) {
      fragments.push(frag(colXs[c], y0 - r * rowGap, rows[r][c]))
    }
  }
  const md = buildMarkdownForPage({
    pageIndex: 0,
    fragments,
    mediaBox: [0, 0, 612, 792],
    includeImages: false,
    imageAssets: [],
    assetUrlPrefix: '',
    reconstructTables: true,
    tableMinColumns: 2,
    tableMinRows: 3,
    tableMaxRows: 50,
  })
  if (!md.includes('| Name | Qty | Price |')) throw new Error('expected markdown table header')
  if (!/\| -{3,} \| -{3,} \| -{3,} \|/.test(md)) throw new Error('expected markdown table separator')
  if (!md.includes('| Apple | 2 | $3 |')) throw new Error('expected markdown table row')
}
