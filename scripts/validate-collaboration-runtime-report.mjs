import path from 'node:path'
import { text } from 'node:stream/consumers'
import {
  validateCollaborationRuntimeReportArtifact,
  validateCollaborationRuntimeReportSource,
} from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
if (args.length !== 1) {
  throw new Error('usage: npm run collaboration:report:check -- <report.json|->')
}

const result = args[0] === '-'
  ? await validateCollaborationRuntimeReportSource(await text(process.stdin))
  : await validateCollaborationRuntimeReportArtifact(path.resolve(args[0]))
console.log(`[knowgrph] collaboration runtime report passed (${result.schemaVersion})`)
