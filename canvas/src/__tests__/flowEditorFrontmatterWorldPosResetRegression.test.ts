import fs from 'node:fs'
import path from 'node:path'

export const testFlowEditorFrontmatterImportResetsWorldWidgetPositions = () => {
  const documentActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataDocumentActions.ts',
  )
  const text = fs.readFileSync(documentActionPath, 'utf8')
  const enforceFrontmatterOnlyIndex = text.indexOf('if (enforceFrontmatterOnly) {')
  const worldPosResetIndex = text.indexOf('afterApplyState.setFlowWidgetWorldPosByNodeId({})')
  if (enforceFrontmatterOnlyIndex < 0 || worldPosResetIndex < 0) {
    throw new Error('Expected frontmatter-only flow import path to reset persisted widget world positions')
  }
  if (worldPosResetIndex < enforceFrontmatterOnlyIndex) {
    throw new Error('Expected world position reset to happen inside the frontmatter-only import guard')
  }
}
