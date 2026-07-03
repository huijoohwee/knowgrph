import { readFileSync } from 'node:fs'

export function testRichMediaPanelDirectMediaPreviewIsFixed() {
  const directSurfaceText = readFileSync(new URL('../components/RichMediaPanelDirectMediaSurface.tsx', import.meta.url), 'utf8')
  const surfaceStateText = readFileSync(new URL('../components/useRichMediaPanelSurfaceState.ts', import.meta.url), 'utf8')

  for (const fixedViewportProp of ['disablePan', 'lockViewportAtFitScale']) {
    if (!directSurfaceText.includes(fixedViewportProp)) {
      throw new Error(`expected direct Rich Media preview to use fixed viewport mode: ${fixedViewportProp}`)
    }
  }
  if (!surfaceStateText.includes('ariaLabel: `${mediaState.title} media preview`')) {
    throw new Error('expected direct Rich Media preview label to avoid draggable pan/zoom semantics')
  }
  if (surfaceStateText.includes('pan and zoom media preview')) {
    throw new Error('expected stale Rich Media pan/zoom preview semantics to be removed')
  }
}
