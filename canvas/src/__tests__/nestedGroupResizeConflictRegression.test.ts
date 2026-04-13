import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testNestedGroupResizeKeepsExclusiveActiveHandleOwnership() {
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))
  if (!layoutText.includes('const canResize = args.allowResize && (isActiveResize || (!activeResizeGroupId && isSelected))')) {
    throw new Error('expected active resize to own handle visibility exclusively so nested parent and child handles do not compete')
  }
  if (!layoutText.includes("handleEl.setAttribute('data-kg-group-resize-active', isActiveResize ? '1' : '0')")) {
    throw new Error('expected active resize handle ownership to remain source-visible')
  }
}

export function testNestedGroupResizeRaisesActiveShapeLayer() {
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))
  if (!layoutText.includes('rect.parentNode?.appendChild(rect)')) {
    throw new Error('expected active rect groups to raise within their shape layer during resize')
  }
  if (!layoutText.includes('path.parentNode?.appendChild(path)')) {
    throw new Error('expected active geo groups to raise within their shape layer during resize')
  }
}
