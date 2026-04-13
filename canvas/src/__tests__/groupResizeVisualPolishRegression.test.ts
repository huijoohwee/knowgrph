import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testGroupResizeVisualPolishKeepsActiveOutlineAndLabelFeedback() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))

  if (!groupsText.includes("data-kg-base-stroke-width")) {
    throw new Error('expected group visuals to preserve a base stroke-width attribute for active resize emphasis')
  }
  if (!groupsText.includes("data-kg-base-fill-opacity")) {
    throw new Error('expected group visuals to preserve a base fill-opacity attribute for active resize emphasis')
  }
  if (!layoutText.includes("labelEl.setAttribute('font-weight', isActiveResize ? '700' : '500')")) {
    throw new Error('expected active resize to emphasize the group label weight')
  }
  if (!layoutText.includes("chevronEl.setAttribute('stroke-width', String(isActiveResize ? 2.3 : 1.75))")) {
    throw new Error('expected active resize to emphasize the group chevron stroke')
  }
}

export function testGroupResizeVisualPolishRaisesActiveGroupAndUsesGrabbingCursor() {
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))
  if (!layoutText.includes("handleEl.style.cursor = isActiveResize ? 'grabbing' : 'nwse-resize'")) {
    throw new Error('expected active resize handle to switch to a grabbing cursor')
  }
  if (!layoutText.includes("hitRect.style.cursor = isActiveResize ? 'grabbing' : 'grab'")) {
    throw new Error('expected active rect hit areas to reflect grabbing cursor during resize')
  }
  if (!layoutText.includes('labelEl.parentNode.appendChild(labelEl)')) {
    throw new Error('expected active resize visuals to raise the group label within its layer')
  }
  if (!layoutText.includes('handleEl.parentNode?.appendChild(handleEl)')) {
    throw new Error('expected active resize visuals to raise the handle within its layer')
  }
}
