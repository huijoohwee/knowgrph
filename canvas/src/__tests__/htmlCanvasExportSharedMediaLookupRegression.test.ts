import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testHtmlCanvasExportReusesSharedPanelAndMediaLookupHelpers() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts')
  const text = readFileSync(filePath, 'utf8')

  const requiredSnippets = [
    'buildPanelOnlyNodeIdSetFromGraphNodes',
    'buildNodeMediaInventory',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected htmlCanvasSvgExport to use shared helper: ${snippet}`)
    }
  }

  const forbiddenSnippets = [
    'looksLikeSingleTagBlock',
    "if (type === 'Paragraph') {",
    'const spec = getNodeMediaSpec(n)',
  ]
  for (const snippet of forbiddenSnippets) {
    if (text.includes(snippet)) {
      throw new Error(`expected htmlCanvasSvgExport to remove duplicated local scan snippet: ${snippet}`)
    }
  }
}
