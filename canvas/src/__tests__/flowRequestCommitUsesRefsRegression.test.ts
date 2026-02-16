import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowRequestCommitUsesSchemaAndGraphRefsToAvoidChurn() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowRequestCommit.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('schemaRef.current')) {
    throw new Error('expected Flow commit hook to read schema via ref to avoid callback churn')
  }
  if (!text.includes('graphDataForZoomRef.current')) {
    throw new Error('expected Flow commit hook to read graph data via ref to avoid callback churn')
  }
}

