import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testNestedResizeSemanticEmphasisClassifiesParentChildRelations() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))

  if (!groupsText.includes('const parentGroupIdById = new Map<string, string | null>()')) {
    throw new Error('expected groups layer to provide parent-group lineage to the shared layout engine')
  }
  if (!layoutText.includes("const classifyResizeRelation = (groupId: string, activeResizeGroupId: string): 'active' | 'ancestor' | 'descendant' | 'neutral' =>")) {
    throw new Error('expected layout engine to classify active, ancestor, and descendant resize relations')
  }
  if (!layoutText.includes("if (cursor === id) return 'ancestor'")) {
    throw new Error('expected resize relation classification to detect ancestors of the active group')
  }
  if (!layoutText.includes("if (cursor === activeId) return 'descendant'")) {
    throw new Error('expected resize relation classification to detect descendants of the active group')
  }
}

export function testNestedResizeSemanticEmphasisStylesAncestorsAndDescendantsDifferently() {
  const layoutText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groupsLayout.ts'))
  if (!layoutText.includes("rect.setAttribute('data-kg-group-resize-relation', resizeRelation)")) {
    throw new Error('expected rect groups to expose semantic resize relation state')
  }
  if (!layoutText.includes("labelEl.setAttribute('opacity', isActiveResize ? '1' : isAncestorResizeRelation ? '0.94' : isDescendantResizeRelation ? '0.78' : '0.94')")) {
    throw new Error('expected nested resize labels to distinguish ancestor and descendant emphasis')
  }
  if (!layoutText.includes("chevronEl.style.opacity = isActiveResize ? '1' : isAncestorResizeRelation ? '0.96' : isDescendantResizeRelation ? '0.78' : '0.92'")) {
    throw new Error('expected nested resize chevrons to distinguish ancestor and descendant emphasis')
  }
}
