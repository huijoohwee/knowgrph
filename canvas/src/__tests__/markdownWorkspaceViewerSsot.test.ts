import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownWorkspaceViewerUsesMarkdownPreviewSsot = () => {
  const p = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'MarkdownWorkspaceMain.tsx')
  const text = readUtf8(p)
  if (!text.includes('<MarkdownPreview')) {
    throw new Error('Expected MarkdownWorkspaceMain viewer to render MarkdownPreview')
  }
  if (text.includes('MarkdownPreviewViewer')) {
    throw new Error('Expected MarkdownWorkspaceMain to avoid MarkdownPreviewViewer for SSOT')
  }
  if (text.includes('lexMarkdown')) {
    throw new Error('Expected MarkdownWorkspaceMain to avoid manual lexMarkdown for SSOT')
  }
}

