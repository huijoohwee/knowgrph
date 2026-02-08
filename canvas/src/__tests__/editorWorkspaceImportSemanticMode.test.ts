import { shouldForceDocumentSemanticModeForImport } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'

export const testEditorWorkspaceImportForcesDocumentModeForGraphFiles = () => {
  if (shouldForceDocumentSemanticModeForImport('note.md') !== false) throw new Error('expected markdown not to force document semantic mode')
  if (shouldForceDocumentSemanticModeForImport('workflow.json') !== true) throw new Error('expected json to force document semantic mode')
  if (shouldForceDocumentSemanticModeForImport('workflow.jsonld') !== true) throw new Error('expected jsonld to force document semantic mode')
  if (shouldForceDocumentSemanticModeForImport('graph.csv') !== true) throw new Error('expected csv to force document semantic mode')
  if (shouldForceDocumentSemanticModeForImport('layer.geojson') !== true) throw new Error('expected geojson to force document semantic mode')
  if (shouldForceDocumentSemanticModeForImport('schema.yaml') !== true) throw new Error('expected yaml to force document semantic mode')
}

