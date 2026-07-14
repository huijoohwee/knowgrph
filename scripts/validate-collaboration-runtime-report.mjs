import path from 'node:path'
import { text } from 'node:stream/consumers'
import {
  validateCollaborationRuntimeReportArtifact,
  validateCollaborationRuntimeReportSource,
} from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
const jsonOutput = args[0] === '--json'
const inputArgs = jsonOutput ? args.slice(1) : args
if (inputArgs.length !== 1) {
  throw new Error('usage: npm run collaboration:report:check -- [--json] <report.json|->')
}

const input = inputArgs[0]
const inputType = input === '-' ? 'stdin' : 'file'
const result = inputType === 'stdin'
  ? await validateCollaborationRuntimeReportSource(await text(process.stdin))
  : await validateCollaborationRuntimeReportArtifact(path.resolve(input))

if (jsonOutput) {
  console.log(JSON.stringify({
    status: 'passed',
    schemaId: result.schemaId,
    schemaVersion: result.schemaVersion,
    input: inputType,
  }, null, 2))
} else {
  console.log(`[knowgrph] collaboration runtime report passed (${result.schemaVersion})`)
}
