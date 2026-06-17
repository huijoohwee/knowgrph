import { readFileSync } from 'node:fs'

export function testFlowEditorWorkflowRunActionIsSharedBetweenFlowEditorAndStoryboard() {
  const sharedSource = readFileSync(new URL('../components/FlowEditorCanvas/runtime/flowEditorWorkflowRunAction.ts', import.meta.url), 'utf8')
  const hookSource = readFileSync(new URL('../components/FlowEditorCanvas/runtime/useFlowEditorWorkflowActions.ts', import.meta.url), 'utf8')
  const storyboardSource = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')

  for (const snippet of [
    'export function createFlowEditorWorkflowNodeRunner',
    'export function resolveFlowEditorBaseGraphKind',
    'export type FlowEditorWorkflowNodeRunnerArgs',
    'const runWorkflowNode: FlowEditorWorkflowNodeRunner = async',
  ]) {
    if (!sharedSource.includes(snippet)) {
      throw new Error(`expected shared workflow run action to contain snippet: ${snippet}`)
    }
  }

  if (!hookSource.includes("import { createFlowEditorWorkflowNodeRunner } from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRunAction'")) {
    throw new Error('expected Flow Editor workflow hook to import the shared workflow run action')
  }
  if (!hookSource.includes('const runWorkflowNode = React.useMemo(() => createFlowEditorWorkflowNodeRunner({')) {
    throw new Error('expected Flow Editor workflow hook to build runWorkflowNode from the shared workflow run action')
  }
  if (hookSource.includes('const runWorkflowNode = React.useCallback(async (nodeId: string')) {
    throw new Error('expected Flow Editor workflow hook to avoid owning an inline runWorkflowNode implementation')
  }

  if (!storyboardSource.includes("import { createFlowEditorWorkflowNodeRunner, resolveFlowEditorBaseGraphKind } from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRunAction'")) {
    throw new Error('expected StoryboardCanvas to import the shared workflow run action utilities')
  }
  if (!storyboardSource.includes('const runStoryboardWorkflowNode = React.useMemo(() => createFlowEditorWorkflowNodeRunner({')) {
    throw new Error('expected StoryboardCanvas to build its Run action from the shared workflow run action')
  }
  if (!storyboardSource.includes("scheduleOverlayEdgeUpdate: () => {}")) {
    throw new Error('expected StoryboardCanvas to provide a neutral overlay-edge adapter to the shared workflow run action')
  }
}
