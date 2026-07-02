import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetPinnedWidgetDragDoesNotProxyNodeDrag() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('pendingProxyPan')) {
    throw new Error('expected FlowCanvas overlay pan proxy state to exist')
  }
  if (!text.includes("resolved.kind === 'overlay' && overlayPinnedToNode")) {
    throw new Error('expected FlowCanvas to include pinned overlay proxy behavior')
  }
  if (text.includes("const overlayNodeId = String((resolved.overlayRoot as HTMLElement).dataset?.kgWidget")) {
    throw new Error('expected FlowCanvas to avoid proxying pinned widget drag into node drag')
  }
}
