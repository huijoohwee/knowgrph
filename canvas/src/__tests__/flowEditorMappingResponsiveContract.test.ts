import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testFlowEditorMappingLayoutUsesResponsiveOwner() {
  const layoutText = readUtf8('src/features/flow-editor-manager/FlowEditorMappingTabLayout.tsx')
  const cssText = readUtf8('src/styles/flow-editor-manager-responsive.css')
  const indexCssText = readUtf8('src/index.css')

  if (!layoutText.includes("FLOW_EDITOR_MAPPING_LAYOUT_CLASS_NAME = 'kg-flow-editor-mapping-layout'")) {
    throw new Error('expected Flow Editor mapping layout to expose one responsive split owner')
  }
  if (!layoutText.includes('className={FLOW_EDITOR_MAPPING_LAYOUT_CLASS_NAME}')) {
    throw new Error('expected Flow Editor mapping layout to consume the responsive split owner')
  }
  if (layoutText.includes('grid grid-cols-1 lg:grid-cols-[1fr_520px]')) {
    throw new Error('expected Flow Editor mapping layout to avoid inline fixed desktop split tracks')
  }
  if (!indexCssText.includes("@import './styles/flow-editor-manager-responsive.css';")) {
    throw new Error('expected app CSS to import the Flow Editor Manager responsive stylesheet')
  }
  if (!cssText.includes('.kg-flow-editor-mapping-layout') || !cssText.includes('--kg-flow-editor-mapping-panel-width')) {
    throw new Error('expected Flow Editor Manager responsive CSS to own the mapping panel width')
  }
  if (!cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected Flow Editor mapping layout CSS to stay mobile-first')
  }
}
