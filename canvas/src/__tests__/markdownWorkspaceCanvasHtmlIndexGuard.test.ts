import fs from 'node:fs'
import path from 'node:path'

export function testMarkdownWorkspaceCanvasHtmlIndexGuardSkipsExports() {
  const filePath = path.resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'markdownWorkspace',
    'MarkdownWorkspace.tsx',
  )
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('workspaceExtLower(path)')) {
    throw new Error('expected MarkdownWorkspace to use workspaceExtLower(path) when deciding indexing behavior')
  }
  if (!text.includes('id=\\"kg-root\\"') && !text.includes("id='kg-root'")) {
    throw new Error('expected MarkdownWorkspace indexing guard to look for kg-root canvas container')
  }
  if (!text.includes('#kg-stage') || !text.includes('#kg-svgwrap')) {
    throw new Error('expected MarkdownWorkspace indexing guard to match canvas HTML exports by #kg-stage and #kg-svgwrap markers')
  }
}
