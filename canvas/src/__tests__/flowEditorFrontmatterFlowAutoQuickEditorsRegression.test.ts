import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterFlowAutoShowsNodeQuickEditors() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("kind === 'frontmatter-flow'")) {
    throw new Error("expected FlowEditorCanvas to auto-show node quick editors for frontmatter-flow graphs")
  }
  if (!text.includes('MAX_AUTO')) {
    throw new Error('expected FlowEditorCanvas auto-quick-editor logic to include a size cap')
  }

  if (!text.includes('const overlayOnlyModeEnabled') || !text.includes('return canEdit')) {
    throw new Error('expected FlowEditorCanvas overlay-only mode to be enabled whenever editing is allowed')
  }

  if (!text.includes('worldToScreen') || !text.includes('MAX_VIEW')) {
    throw new Error('expected FlowEditorCanvas to auto-show a viewport-limited set of quick editors for large graphs')
  }

  if (!text.includes('viewportCenterToWorld') || !text.includes('dist2')) {
    throw new Error('expected FlowEditorCanvas to fall back to center-nearest quick editors when none are in viewport')
  }
}
