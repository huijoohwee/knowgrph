import path from 'node:path'
import { text } from 'node:stream/consumers'
import {
  validateCollaborationRuntimeValidationArtifact,
  validateCollaborationRuntimeReportArtifact,
  validateCollaborationRuntimeValidationPair,
  validateCollaborationRuntimeValidationSource,
} from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
const hasReportPair = args.length === 3 && args[1] === '--report' && args[2] !== '-'
if (args.length !== 1 && !hasReportPair) {
  throw new Error(
    'usage: npm run collaboration:report:check-result -- <validation.json|-> [--report <report.json>]',
  )
}

const input = args[0]
const result = input === '-'
  ? await validateCollaborationRuntimeValidationSource(await text(process.stdin))
  : await validateCollaborationRuntimeValidationArtifact(path.resolve(input))

if (hasReportPair) {
  const reportIdentity = await validateCollaborationRuntimeReportArtifact(path.resolve(args[2]))
  validateCollaborationRuntimeValidationPair(result, reportIdentity)
}

const pairStatus = hasReportPair ? `, report ${result.reportDigest}` : ''
console.log(`[knowgrph] collaboration validation result passed (${result.schema}, ${result.status}${pairStatus})`)
