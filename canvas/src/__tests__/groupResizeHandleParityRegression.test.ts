import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testGroupResizeHandleKeepsActiveFeedbackAndInsetAnchor() {
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))
  if (!layoutText.includes("data-kg-group-resize-active")) {
    throw new Error('expected group resize handle layout to expose active resize state')
  }
  if (!layoutText.includes("data-kg-group-resize-selected")) {
    throw new Error('expected group resize handle layout to expose selected resize state')
  }
  if (!layoutText.includes('const insetPx = Math.min(handleScale.hitRadiusPx * 0.45')) {
    throw new Error('expected group resize handle anchor to inset from the outer corner for touch parity')
  }
  if (!layoutText.includes('const canResize = args.allowResize && (isSelected || isActiveResize)')) {
    throw new Error('expected active group resize handles to stay visible during drag feedback')
  }
}

export function testGroupResizeHandleBinderPublishesActiveResizeState() {
  const binderText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsResizeHandle.ts'))
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  if (!binderText.includes('onResizeActiveGroupIdChange?: (id: string | null) => void')) {
    throw new Error('expected resize handle binder to publish active resize group state')
  }
  if (!binderText.includes("args.onResizeActiveGroupIdChange?.(String(d.id || '').trim() || null)")) {
    throw new Error('expected resize handle binder to publish the active group id on drag start')
  }
  if (!binderText.includes("args.onResizeActiveGroupIdChange?.(null)")) {
    throw new Error('expected resize handle binder to clear the active group id on drag end')
  }
  if (!groupsText.includes('let activeResizeGroupId =')) {
    throw new Error('expected groups layer to track active resize group state for shared feedback')
  }
}
