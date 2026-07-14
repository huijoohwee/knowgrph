import path from 'node:path'
import { validateCollaborationRuntimeReportArtifact } from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
if (args.length !== 1) {
  throw new Error('usage: npm run collaboration:report:check -- <report.json>')
}

const result = await validateCollaborationRuntimeReportArtifact(path.resolve(args[0]))
console.log(`[knowgrph] collaboration runtime report passed (${result.schemaVersion})`)
