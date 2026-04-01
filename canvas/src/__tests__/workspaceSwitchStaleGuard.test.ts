import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownWorkspaceRuntimeGuardsStaleIndexJobs = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.tsx')
  const text = readUtf8(runtimePath)
  if (!text.includes('const isStaleJob = () =>')) {
    throw new Error('Expected markdown workspace runtime to define stale-index job guard')
  }
  if (!text.includes('if (isStaleJob()) return')) {
    throw new Error('Expected markdown workspace runtime to short-circuit stale jobs before mutating state')
  }
  if (!text.includes('await maybeAutoEnableGeospatialModeForGraphData') || !text.includes('if (isStaleJob()) return')) {
    throw new Error('Expected geospatial auto-enable path to be protected by stale-job guard')
  }
}
