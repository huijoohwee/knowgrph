import fs from 'node:fs'
import path from 'node:path'

export function testMonacoLongHtmlPlaceholderIsVisibleAndEllipsized() {
  const root = process.cwd()
  const filePath = path.join(root, 'src', 'lib', 'monaco', 'MonacoTextEditor.impl.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes('kg-monaco-ellipsis-long-html-line')) {
    throw new Error('Expected visible ellipsis class for long HTML lines')
  }
  if (!/text-overflow:\s*ellipsis/.test(text)) {
    throw new Error('Expected long HTML line styling to include text-overflow: ellipsis')
  }
  if (/kg-monaco-hide-long-line[\s\S]*opacity:\s*0/.test(text)) {
    throw new Error('Expected long HTML line styling to not hide content via opacity:0')
  }
  if (!text.includes('kg-monaco-long-line-placeholder')) {
    throw new Error('Expected long HTML line prefix label placeholder class to exist')
  }
}
