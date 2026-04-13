import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testGroupDragBehaviorReusesSharedIntentThresholds() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  if (!groupsText.includes("import { readCanvasDragIntentThresholdPx } from '@/lib/canvas/dragIntent'")) {
    throw new Error('expected group drag behavior to reuse the shared canvas drag intent helper')
  }
  if (!groupsText.includes('const activateGroupDrag =')) {
    throw new Error('expected group drag behavior to defer layout churn until drag intent is confirmed')
  }
  if (!groupsText.includes('if (!(distancePx >= dragThresholdPx)) return')) {
    throw new Error('expected group drag behavior to block tiny pointer drift before moving group members')
  }
}

export function testGroupLabelClickRespectsPreventedDragClicks() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  if (!groupsText.includes(".on('click', (event: MouseEvent, d: GroupDatum) => {\n      if ((event as unknown as { defaultPrevented?: unknown }).defaultPrevented) return")) {
    throw new Error('expected group label click handling to ignore prevented click events after drag gestures')
  }
}
