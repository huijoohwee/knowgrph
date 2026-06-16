import fs from 'node:fs'
import path from 'node:path'

const read = (parts: string[]) => {
  const filePath = path.resolve(process.cwd(), ...parts)
  return fs.readFileSync(filePath, { encoding: 'utf8' })
}

export function testWorkspaceResizerHandlersAttachAfterMount() {
  const canvasText = read(['src', 'pages', 'Canvas.tsx'])
  const canvasRuntimeText = read(['src', 'features', 'canvas', 'useCanvasWorkspacePaneRuntime.ts'])
  if (canvasText.includes('const resizeHandleRef')) {
    throw new Error('expected Canvas workspace resizer to avoid ref-only pointerdown binding')
  }
  if (!canvasText.includes('ref={setResizeHandleEl}')) {
    throw new Error('expected Canvas workspace resizer shell to forward the live handle element into the shared workspace-pane runtime')
  }
  if (!canvasRuntimeText.includes('const [resizeHandleEl, setResizeHandleEl]')) {
    throw new Error('expected useCanvasWorkspacePaneRuntime to own the element-backed workspace resizer handle state')
  }
  if (canvasRuntimeText.includes('const resizeHandleRef')) {
    throw new Error('expected useCanvasWorkspacePaneRuntime to avoid ref-only pointerdown binding')
  }

  const explorerShellText = read(['src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx'])
  const explorerBootstrapText = read(['src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceBootstrapState.ts'])
  if (explorerShellText.includes('const resizeHandleRef') || explorerBootstrapText.includes('const resizeHandleRef')) {
    throw new Error('expected explorer resizer to avoid ref-only pointerdown binding')
  }
  if (!explorerShellText.includes('ref={setResizeHandleEl}')) {
    throw new Error('expected explorer resizer shell to forward the live handle element into the shared bootstrap state')
  }
  if (!explorerBootstrapText.includes('const [resizeHandleEl, setResizeHandleEl]')) {
    throw new Error('expected explorer resizer bootstrap state to own the element-backed handle state')
  }
}
