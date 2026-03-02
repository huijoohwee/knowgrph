import fs from 'node:fs'
import path from 'node:path'

export function testMarkdownImportSideEffectsAppliesGraphFromImportedMarkdown() {
  const filePath = path.resolve(process.cwd(), 'src/features/toolbar/importSideEffects.ts')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('setActiveMarkdownDocument')) {
    throw new Error('Expected applyImportedMarkdownToStore to use setActiveMarkdownDocument for SSOT updates')
  }
  if (!text.includes('applyToGraph: true')) {
    throw new Error('Expected imported Markdown to be applied to graph for renderer sync')
  }
}
