import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownWorkspaceViewerUsesMarkdownPreviewSsot = () => {
  const entryPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'MarkdownWorkspaceMain.tsx')
  const entryText = readUtf8(entryPath)
  const resolvedText = (() => {
    const m = entryText.match(/from\s+['"](\.\/viewer\/MarkdownWorkspaceDerivedViewer)['"]/)
    if (!m || !m[1]) return entryText
    const targetPath = path.resolve(path.dirname(entryPath), String(m[1])) + '.tsx'
    if (!fs.existsSync(targetPath)) return entryText
    return readUtf8(targetPath)
  })()
  if (!resolvedText.includes('<MarkdownPreview')) {
    throw new Error('Expected MarkdownWorkspaceMain viewer to render MarkdownPreview')
  }
  if (resolvedText.includes('MarkdownPreviewViewer')) {
    throw new Error('Expected MarkdownWorkspaceMain to avoid MarkdownPreviewViewer for SSOT')
  }
  if (resolvedText.includes('lexMarkdown')) {
    throw new Error('Expected MarkdownWorkspaceMain to avoid manual lexMarkdown for SSOT')
  }
}
