import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphFieldsViewAddsSmartMediaQuickEditorGalleryPresetSetup() {
  const graphFieldsViewPath = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const text = readFileSync(graphFieldsViewPath, 'utf8')

  if (!text.includes('Quick Editor Gallery')) {
    throw new Error('expected Graph Fields view to render Quick Editor Gallery section')
  }
  if (!text.includes('max-h-28 overflow-auto')) {
    throw new Error('expected Graph Fields quick editor gallery section to be scrollable')
  }
  if (!text.includes('buildNodeQuickEditorDraftFromSmartFields')) {
    throw new Error('expected Graph Fields quick editor gallery to use smart-media preset draft template')
  }
  if (!text.includes('FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY')) {
    throw new Error('expected Graph Fields quick editor setup to stamp node quick-editor type key')
  }
  if (!text.includes('FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY')) {
    throw new Error('expected Graph Fields quick editor setup to stamp node quick-editor form key')
  }
  if (!text.includes('upsertNodeQuickEditorRegistryEntry')) {
    throw new Error('expected Graph Fields quick editor setup to upsert registry preset')
  }
  if (!text.includes('updateNode(nodeId, { properties: nextProps } as never)')) {
    throw new Error('expected Graph Fields quick editor setup to apply preset mapping to selected node')
  }
}
