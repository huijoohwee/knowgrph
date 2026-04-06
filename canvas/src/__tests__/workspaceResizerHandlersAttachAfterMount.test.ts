import fs from 'node:fs'
import path from 'node:path'

const read = (parts: string[]) => {
  const filePath = path.resolve(process.cwd(), ...parts)
  return fs.readFileSync(filePath, { encoding: 'utf8' })
}

export function testWorkspaceResizerHandlersAttachAfterMount() {
  const canvasText = read(['src', 'pages', 'Canvas.tsx'])
  if (canvasText.includes('const resizeHandleRef')) {
    throw new Error('expected Canvas workspace resizer to avoid ref-only pointerdown binding')
  }
  if (!canvasText.includes('const [resizeHandleEl, setResizeHandleEl]')) {
    throw new Error('expected Canvas workspace resizer to bind to an element-backed state')
  }

  const explorerText = read(['src', 'features', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.tsx'])
  if (explorerText.includes('const resizeHandleRef')) {
    throw new Error('expected explorer resizer to avoid ref-only pointerdown binding')
  }
  if (!explorerText.includes('const [resizeHandleEl, setResizeHandleEl]')) {
    throw new Error('expected explorer resizer to bind to an element-backed state')
  }

  const graphTableText = read(['src', 'features', 'graph-table', 'ui', 'GraphTableWorkspace.tsx'])
  if (!graphTableText.includes('const [inspectorDragHandleEl, setInspectorDragHandleEl]')) {
    throw new Error('expected graph table inspector resizer to bind to an element-backed state')
  }
}

