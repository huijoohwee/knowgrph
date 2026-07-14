import { readCollaborationRuntimeReportSchemaSource } from './collaboration-runtime-report.mjs'

const args = process.argv.slice(2)
if (args.length > 0) {
  throw new Error(`unsupported collaboration report schema arguments: ${args.join(' ')}`)
}

process.stdout.write(await readCollaborationRuntimeReportSchemaSource())
