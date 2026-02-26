import fs from 'node:fs'
import path from 'node:path'

export function testMonacoHtmlBlockCollapseShowsPreview() {
  const root = process.cwd()
  const filePath = path.join(root, 'src', 'features', 'monaco', 'MonacoTextEditor.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes('kg-monaco-ellipsis-long-html-line')) {
    throw new Error('Expected collapsed HTML blocks to reuse the visible ellipsis class')
  }
  if (!text.includes('⟪collapsed')) {
    throw new Error('Expected collapsed HTML blocks to include a visible placeholder label')
  }
  if (!text.includes('expandedHtmlBlockKeysRef')) {
    throw new Error('Expected collapsed HTML blocks to support expanding via stored expanded keys')
  }
  if (!text.includes('htmlBlockToggleByLineRef')) {
    throw new Error('Expected collapsed HTML blocks to map placeholder lines for toggling')
  }
  if (!/expandedHtmlBlockKeysRef\.current\.has/.test(text)) {
    throw new Error('Expected collapse logic to check expanded state')
  }
  if (/kg-monaco-hide-long-block-line/.test(text)) {
    throw new Error('Expected no hidden block line class to remain')
  }
  if (/setHiddenAreas\(\[\]\)/.test(text) && !/addHiddenArea/.test(text)) {
    throw new Error('Unexpected hidden areas usage')
  }
}
