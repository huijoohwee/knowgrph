import path from 'node:path'
import { text } from 'node:stream/consumers'
import {
  validateCollaborationRuntimeValidationArtifact,
  validateCollaborationRuntimeValidationSource,
} from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
if (args.length !== 1) {
  throw new Error('usage: npm run collaboration:report:check-result -- <validation.json|->')
}

const input = args[0]
const result = input === '-'
  ? await validateCollaborationRuntimeValidationSource(await text(process.stdin))
  : await validateCollaborationRuntimeValidationArtifact(path.resolve(input))

const schemaVersion = result.schemaVersion ?? result.schema
console.log(`[knowgrph] collaboration validation result passed (${schemaVersion}, ${result.status})`)
