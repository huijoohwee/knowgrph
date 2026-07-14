import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { repoRoot } from './collaboration-contract.mjs'

export const COLLABORATION_RUNTIME_REPORT_SCHEMA = 'knowgrph.collaboration-runtime-report/v1'
export const COLLABORATION_RUNTIME_REPORT_SCHEMA_PATH = path.resolve(
  repoRoot,
  'schemas',
  'collaboration-runtime-report.v1.schema.json',
)

let validatorPromise = null

const loadValidator = async () => {
  if (!validatorPromise) {
    validatorPromise = readFile(COLLABORATION_RUNTIME_REPORT_SCHEMA_PATH, 'utf8')
      .then(source => {
        const schema = JSON.parse(source)
        const ajv = new Ajv2020({ allErrors: true, strict: true })
        return { ajv, schema, source, validate: ajv.compile(schema) }
      })
  }
  return validatorPromise
}

export const readCollaborationRuntimeReportSchema = async () => {
  const { schema } = await loadValidator()
  return structuredClone(schema)
}

export const readCollaborationRuntimeReportSchemaSource = async () => {
  const { source } = await loadValidator()
  return source
}

export const validateCollaborationRuntimeReport = async report => {
  const { ajv, schema, validate } = await loadValidator()
  if (!validate(report)) {
    const detail = ajv.errorsText(validate.errors, { dataVar: 'report', separator: '; ' })
    throw new Error(`invalid ${COLLABORATION_RUNTIME_REPORT_SCHEMA}: ${detail}`)
  }
  return {
    schemaId: schema.$id,
    schemaVersion: report.schema,
  }
}

export const validateCollaborationRuntimeReportArtifact = async artifactPath => {
  const report = JSON.parse(await readFile(artifactPath, 'utf8'))
  const identity = await validateCollaborationRuntimeReport(report)
  return { artifactPath, ...identity }
}
