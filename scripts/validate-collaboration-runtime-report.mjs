import path from 'node:path'
import { text } from 'node:stream/consumers'
import {
  validateCollaborationRuntimeReportArtifact,
  validateCollaborationRuntimeReportSource,
} from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
const jsonOutput = args[0] === '--json'
const inputArgs = jsonOutput ? args.slice(1) : args
const inputType = inputArgs[0] === '-' ? 'stdin' : inputArgs[0] ? 'file' : 'unknown'

const classifyError = error => {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('usage:')) return { code: 'invalid-arguments', message }
  if (error instanceof SyntaxError) return { code: 'invalid-json', message }
  if (message.startsWith('invalid knowgrph.collaboration-runtime-report/')) {
    return { code: 'schema-validation-failed', message }
  }
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    return { code: 'input-read-failed', message }
  }
  return { code: 'validation-failed', message }
}

const main = async () => {
  if (inputArgs.length !== 1) {
    throw new Error('usage: npm run collaboration:report:check -- [--json] <report.json|->')
  }

  const input = inputArgs[0]
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
}

try {
  await main()
} catch (error) {
  if (!jsonOutput) throw error
  process.stderr.write(`${JSON.stringify({
    status: 'failed',
    input: inputType,
    error: classifyError(error),
  }, null, 2)}\n`)
  process.exitCode = 1
}
