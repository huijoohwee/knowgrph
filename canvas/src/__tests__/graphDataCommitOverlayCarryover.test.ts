import fs from 'node:fs'
import path from 'node:path'

export function testGraphDataCommitCarriesOverlayStateOnlyAcrossSameSourceIdentity() {
  const filePath = path.resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  if (!text.includes('function readGraphSourceIdentity(')) {
    throw new Error('expected graph commit actions to define a source-identity gate before carrying overlay UI state across commits')
  }
  if (!text.includes('currentSourceIdentity === nextSourceIdentity')) {
    throw new Error('expected graph commit actions to require matching source identity before carrying same-source overlay UI state')
  }
}
