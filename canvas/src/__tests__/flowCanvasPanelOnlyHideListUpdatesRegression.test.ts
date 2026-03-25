import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasPanelOnlyHideListUpdatesOnPanelOnlyChange() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const updateOverlayHiddenDrawArgs')) {
    throw new Error('expected FlowCanvas to centralize overlay hide list updates')
  }
  if (!text.includes('panelOnlyNodeIdSetRef.current = panelOnlyNodeIdSet')) {
    throw new Error('expected FlowCanvas to update panelOnlyNodeIdSetRef')
  }
  if (!text.includes('updateOverlayHiddenDrawArgs()')) {
    throw new Error('expected FlowCanvas to recompute hide lists when overlays/panelOnly change')
  }
}

