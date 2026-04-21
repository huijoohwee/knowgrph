import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphFieldsViewAddsSmartMediaWidgetGalleryPresetSetup() {
  const flowEditorGraphTabPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const graphFieldsViewPath = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const text = readFileSync(flowEditorGraphTabPath, 'utf8')
  const graphFieldsViewText = readFileSync(graphFieldsViewPath, 'utf8')

  const hasConsolidatedEntryAlias =
    text.includes('Consolidated Entries (click to open Field Settings)') &&
    text.includes('Nodes · Widget Gallery') &&
    text.includes('Clusters · Samples')

  if (text.includes('buildWidgetDraftFromSmartFields')) {
    throw new Error('expected Workflow Manager graph tab to avoid local widget preset setup logic after consolidation')
  }
  if (!hasConsolidatedEntryAlias) {
    throw new Error('expected Workflow Manager to keep legacy labels only as consolidated click aliases for Graph Fields right-pane')
  }
  if (!(text.includes('<GraphFieldsView') && text.includes('embedded={true}'))) {
    throw new Error('expected Workflow Manager graph tab to reuse embedded GraphFieldsView in workflow mode')
  }
  if (graphFieldsViewText.includes('Widget Gallery')) {
    throw new Error('expected GraphFieldsView to avoid duplicate Widget Gallery after consolidation')
  }
  if (graphFieldsViewText.includes('FieldSamplesPanel')) {
    throw new Error('expected GraphFieldsView to avoid duplicate standalone Samples panel after consolidation')
  }
}
