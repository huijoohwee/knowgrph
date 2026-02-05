import fs from 'node:fs'
import path from 'node:path'

export function testMarkdownImportActionAppliesImportedMarkdownToStore() {
  const actionPath = path.resolve(process.cwd(), 'src/features/toolbar/markdownImportAction.ts')
  let text = ''
  try {
    text = fs.readFileSync(actionPath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${actionPath}`)
  }
  if (!text.includes('applyImportedMarkdownToStore')) {
    throw new Error('Expected markdownImportAction to apply imported markdown to store via applyImportedMarkdownToStore')
  }
}

