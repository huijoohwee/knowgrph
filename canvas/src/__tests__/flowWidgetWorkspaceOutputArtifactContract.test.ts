import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetTextRunsPersistWorkspaceOutputArtifacts() {
  const workflowActionsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetWorkflowRunAction.ts'), 'utf8')
  const richMediaRunText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts'), 'utf8')

  if (!richMediaRunText.includes('export const writeTextWidgetRunOutputArtifact = async (args: {')) {
    throw new Error('expected text widget run outputs to use one shared workspace artifact writer')
  }
  if (!richMediaRunText.includes('writeWorkspaceTextArtifactAtPath({') || !richMediaRunText.includes('applyWorkspaceImportToCanvas({')) {
    throw new Error('expected shared text widget artifact writer to persist Workspace FS text and passively register Source Files')
  }
  if (!workflowActionsText.includes('writeTextWidgetRunOutputArtifact({')) {
    throw new Error('expected Storyboard Widget text/transcript run finalizers to land generated output in the Editor Workspace')
  }
  if (!workflowActionsText.includes('outputPath: panelArgs.outputPath') || !workflowActionsText.includes("model: 'youtube', outputPath })") || !workflowActionsText.includes('publishTextRunOutput(result, false, outputPath)')) {
    throw new Error('expected Storyboard Widget text run patches to carry the shared workspace output path into widgets and Rich Media Panels')
  }
}

export function testStoryboardWidgetRichMediaRunsPersistWorkspaceManifests() {
  const workflowMediaHandlersText = readFileSync(resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetWorkflowMediaRunHandlers.ts'), 'utf8')
  const richMediaRunText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts'), 'utf8')

  if (!richMediaRunText.includes('export const writeRichMediaWidgetRunOutputArtifact = async (args: {')) {
    throw new Error('expected image/video widget run outputs to use one shared rich-media workspace artifact writer')
  }
  if (!richMediaRunText.includes('writeWorkspaceBlobArtifactAtPath({') || !richMediaRunText.includes('writeWorkspaceTextArtifactAtPath({') || !richMediaRunText.includes('buildGeneratedMediaManifestMarkdown({')) {
    throw new Error('expected shared rich-media artifact writer to persist the binary asset and editable markdown manifest')
  }
  if (!richMediaRunText.includes('createdPaths: [outputPath, outputManifestPath]') || !richMediaRunText.includes('workspaceEntries: buildGeneratedMediaWorkspaceEntries({') || !richMediaRunText.includes('applyToGraph: false')) {
    throw new Error('expected generated rich-media binary and manifest to register in Source Files without graph recomposition')
  }
  if (!workflowMediaHandlersText.includes('outputManifestPath: richMediaResult.outputManifestPath')) {
    throw new Error('expected Storyboard Widget image/video run patches to carry the shared workspace manifest path')
  }
}
