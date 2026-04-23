import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetToolbarAutoShowsOnFirstSelectionTransition() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(overlayPath, 'utf8')

  const requiredSnippets = [
    'const wasSelectedRef = React.useRef(false)',
    'const selected = !!id && selectedNodeId === id',
    'if (selected && !wasSelectedRef.current) {',
    'setToolbarVisible(true)',
    'wasSelectedRef.current = selected',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected NodeOverlayEditor to auto-show floating toolbar when widget selection transitions to active: ${snippet}`)
    }
  }
}

export function testFlowWidgetToolbarVisibleWhenViewLockOn() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const toolbarText = readFileSync(toolbarPath, 'utf8')

  if (!overlayText.includes('onPointerDownCapture={(ev) => {')) {
    throw new Error('expected NodeOverlayEditor to keep pointer-down selection path for widget clicks')
  }
  if (overlayText.includes('if (!active) return')) {
    const aroundPointerDown = overlayText.includes('onPointerDownCapture={(ev) => {\n        if (!active) return')
    if (aroundPointerDown) {
      throw new Error('expected widget click in View Lock ON to still allow showing floating-toolbar')
    }
  }
  if (toolbarText.includes('if (!visible || !active) return null')) {
    throw new Error('expected floating-toolbar to remain visible in View Lock ON')
  }
  if (toolbarText.includes('const disabledByViewLock = !active')) {
    throw new Error('expected floating-toolbar actions to remain clickable in View Lock ON')
  }
}
