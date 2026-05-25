import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

export function testFlowEditorInspectorUsesSharedSectionChooser() {
  const text = read('src/components/FlowEditor/FlowEditorInspectorTabs.tsx')
  if (!text.includes('<ToolbarDropdownSelect') || !text.includes('title={`Inspector section:') || text.includes('aria-label="Inspector tabs"')) {
    throw new Error('expected Flow Editor inspector section switching to use the shared click-expand-down chooser instead of a local horizontal tabs row')
  }
}

export function testFlowEditorSpecificationUsesSharedSectionChooser() {
  const text = read('src/features/flow-editor-manager/FlowEditorSpecificationTab.tsx')
  if (!text.includes('<ToolbarDropdownSelect') || !text.includes('title={`Specification section:') || text.includes('aria-label="Specification tabs"')) {
    throw new Error('expected Flow Editor specification section switching to use the shared click-expand-down chooser instead of a local horizontal tabs row')
  }
}
