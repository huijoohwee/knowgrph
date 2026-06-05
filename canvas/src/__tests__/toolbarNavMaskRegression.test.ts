import fs from 'node:fs'
import path from 'node:path'

export function testToolbarNavMasksCanvasUnderlay() {
  const filePath = path.resolve(process.cwd(), 'src/pages/Canvas.tsx')
  const classFilePath = path.resolve(process.cwd(), 'src/lib/ui/responsiveElementClasses.ts')
  let text = ''
  let classText = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
    classText = fs.readFileSync(classFilePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath} and ${classFilePath}`)
  }
  if (!text.includes('UI_RESPONSIVE_CANVAS_PAGE_SURFACE_CLASSNAME') || !classText.includes('relative flex h-[100dvh]')) {
    throw new Error('Expected root canvas container to be positioned (relative) so split-mode header can overlay the canvas')
  }
  if (!text.includes('UI_RESPONSIVE_CANVAS_TOOLBAR_DOCK_CLASSNAME') || !classText.includes('bg-transparent')) {
    throw new Error('Expected toolbar nav to be transparent so renderer visuals remain visible underneath')
  }
  if (!classText.includes('pointer-events-none')) {
    throw new Error('Expected toolbar nav wrapper to not block pointer events for the canvas underneath')
  }
  if (!classText.includes('pointer-events-auto')) {
    throw new Error('Expected toolbar content to remain interactive inside a pointer-events-none nav wrapper')
  }
  if (!text.includes('Workspace Toolbar Header')) {
    throw new Error('Expected workspace toolbar header to exist as a sibling of the editor overlay shell')
  }
  if (!text.includes('toolbarHeaderElevated')) {
    throw new Error('Expected workspace toolbar header to use dynamic z-index toggle via toolbarHeaderElevated state')
  }
  if (!text.includes("toolbarHeaderElevated ? 'z-[420]' : 'z-[290]'")) {
    throw new Error('Expected workspace toolbar header to default below the workspace editor shell and elevate above it after toolbar interaction')
  }
  if (!text.includes('UI_RESPONSIVE_CANVAS_TOOLBAR_DOCK_CLASSNAME')) {
    throw new Error('Expected canvas toolbar nav geometry to stay on the shared responsive dock owner')
  }
}
