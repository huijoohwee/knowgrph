import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorTextRunsPersistWorkspaceOutputArtifacts() {
  const workflowActionsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts'), 'utf8')
  const richMediaRunText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts'), 'utf8')

  if (!richMediaRunText.includes('export const writeTextWidgetRunOutputArtifact = async (args: {')) {
    throw new Error('expected text widget run outputs to use one shared workspace artifact writer')
  }
  if (!richMediaRunText.includes('writeWorkspaceTextArtifactAtPath({') || !richMediaRunText.includes('applyWorkspaceImportToCanvas({')) {
    throw new Error('expected shared text widget artifact writer to persist Workspace FS text and passively register Source Files')
  }
  if (!workflowActionsText.includes('writeTextWidgetRunOutputArtifact({')) {
    throw new Error('expected Flow Editor text/transcript run finalizers to land generated output in the Editor Workspace')
  }
  if (!workflowActionsText.includes('outputPath: panelArgs.outputPath') || !workflowActionsText.includes("model: 'youtube', outputPath })") || !workflowActionsText.includes('publishTextRunOutput(result, false, outputPath)')) {
    throw new Error('expected Flow Editor text run patches to carry the shared workspace output path into widgets and Rich Media Panels')
  }
}

export function testFlowEditorRichMediaRunsPersistWorkspaceManifests() {
  const workflowActionsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts'), 'utf8')
  const richMediaRunText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts'), 'utf8')

  if (!richMediaRunText.includes('export const writeRichMediaWidgetRunOutputArtifact = async (args: {')) {
    throw new Error('expected image/video widget run outputs to use one shared rich-media workspace artifact writer')
  }
  if (!richMediaRunText.includes('writeWorkspaceBlobArtifactAtPath({') || !richMediaRunText.includes('writeWorkspaceTextArtifactAtPath({') || !richMediaRunText.includes('buildGeneratedMediaManifestMarkdown({')) {
    throw new Error('expected shared rich-media artifact writer to persist the binary asset and editable markdown manifest')
  }
  if (!richMediaRunText.includes('createdPaths: [outputManifestPath]') || !richMediaRunText.includes('opts: { applyToGraph: false }')) {
    throw new Error('expected generated rich-media manifest to register in Source Files without graph recomposition')
  }
  if (!workflowActionsText.includes('outputManifestPath: richMediaResult.outputManifestPath')) {
    throw new Error('expected Flow Editor image/video run patches to carry the shared workspace manifest path')
  }
}
