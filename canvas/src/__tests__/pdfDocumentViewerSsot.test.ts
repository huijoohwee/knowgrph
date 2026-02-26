import fs from 'node:fs'
import path from 'node:path'

export function testPdfDocumentViewerUsesMarkdownPreviewSsot() {
  const root = process.cwd()
  const filePath = path.join(root, 'src', 'pages', 'PdfDocumentViewer.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes("import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'")) {
    throw new Error('Expected PdfDocumentViewer to use MarkdownPreview SSOT renderer')
  }
  if (/\bmarkdown-it\b/i.test(text)) {
    throw new Error('Expected PdfDocumentViewer to not depend on markdown-it')
  }
  if (/dangerouslySetInnerHTML/.test(text)) {
    throw new Error('Expected PdfDocumentViewer to not use dangerouslySetInnerHTML')
  }
}

