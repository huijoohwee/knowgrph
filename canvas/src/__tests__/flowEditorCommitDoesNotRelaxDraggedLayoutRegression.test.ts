import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorCommitDoesNotRelaxDraggedLayout() {
  const p1 = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvas = readFileSync(p1, 'utf8')
  if (!flowCanvas.includes("disableRelaxOnCommit: canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowCanvas to disable commit relaxation in FlowEditor mode')
  }
  const p2 = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowRequestCommit.ts')
  const hook = readFileSync(p2, 'utf8')
  if (!hook.includes('disableRelaxOnCommit')) {
    throw new Error('expected useFlowRequestCommit to accept a disableRelaxOnCommit option')
  }
  if (!hook.includes('if (disableRelaxOnCommit === true)')) {
    throw new Error('expected useFlowRequestCommit to bypass relaxFlowSceneNodePositions when disableRelaxOnCommit is true')
  }
}
