import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { repoRoot } from '../collaboration-contract.mjs'
import {
  COLLABORATION_RUNTIME_REPORT_SCHEMA,
  COLLABORATION_RUNTIME_REPORT_SCHEMA_PATH,
  COLLABORATION_RUNTIME_VALIDATION_SCHEMA,
  COLLABORATION_RUNTIME_VALIDATION_SCHEMA_PATH,
  readCollaborationRuntimeReportSchema,
  readCollaborationRuntimeValidationSchema,
  validateCollaborationRuntimeReport,
  validateCollaborationRuntimeValidation,
} from '../collaboration-runtime-report.mjs'

const readLocalReport = () => {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key.startsWith('KNOWGRPH_PR_') || key === 'KNOWGRPH_GITHUB_TOKEN') delete env[key]
  }
  const result = spawnSync(process.execPath, ['scripts/check-collaboration-runtime.mjs', '--json'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('standalone checker emits a schema-valid machine report', async () => {
  const report = readLocalReport()
  const identity = await validateCollaborationRuntimeReport(report)

  assert.equal(identity.schemaVersion, COLLABORATION_RUNTIME_REPORT_SCHEMA)
  assert.equal(report.status, 'passed')
  assert.equal(report.policies.runtimeDocsWorkflow.status, 'passed')
  assert.ok(report.policies.runtimeDocsWorkflow.consumers.includes('.github/workflows/integration.yml'))
  assert.equal(report.policies.pullRequestCoordination.status, 'not-applicable')
})

test('schema command emits the canonical schema without path knowledge', async () => {
  const result = spawnSync('npm', ['run', '--silent', 'collaboration:report:schema'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const commandSchema = JSON.parse(result.stdout)
  const fileSource = await readFile(COLLABORATION_RUNTIME_REPORT_SCHEMA_PATH, 'utf8')
  const fileSchema = JSON.parse(fileSource)
  const sharedSchema = await readCollaborationRuntimeReportSchema()
  assert.equal(result.stdout, fileSource)
  assert.deepEqual(commandSchema, fileSchema)
  assert.deepEqual(sharedSchema, fileSchema)
  assert.equal(commandSchema.$id, 'https://knowgrph.dev/schemas/collaboration-runtime-report/v1')
})

test('validation schema command emits the canonical envelope schema without path knowledge', async () => {
  const result = spawnSync('npm', ['run', '--silent', 'collaboration:report:check-schema'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const commandSchema = JSON.parse(result.stdout)
  const fileSource = await readFile(COLLABORATION_RUNTIME_VALIDATION_SCHEMA_PATH, 'utf8')
  const fileSchema = JSON.parse(fileSource)
  const sharedSchema = await readCollaborationRuntimeValidationSchema()
  assert.equal(result.stdout, fileSource)
  assert.deepEqual(commandSchema, fileSchema)
  assert.deepEqual(sharedSchema, fileSchema)
  assert.equal(commandSchema.$id, 'https://knowgrph.dev/schemas/collaboration-runtime-validation/v1')
})

test('example command emits the canonical local report without pull request context', async () => {
  const result = spawnSync('npm', ['run', '--silent', 'collaboration:report:example'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      KNOWGRPH_PR_NUMBER: '999',
      KNOWGRPH_PR_BASE_REF: 'invalid',
    },
  })
  assert.equal(result.status, 0, result.stderr)

  const example = JSON.parse(result.stdout)
  const identity = await validateCollaborationRuntimeReport(example)
  assert.deepEqual(example, readLocalReport())
  assert.equal(identity.schemaVersion, COLLABORATION_RUNTIME_REPORT_SCHEMA)
  assert.equal(example.policies.pullRequestCoordination.status, 'not-applicable')
})

test('report validator accepts the canonical example through stdin and rejects mutations', async () => {
  const exampleResult = spawnSync('npm', ['run', '--silent', 'collaboration:report:example'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(exampleResult.status, 0, exampleResult.stderr)

  const validationResult = spawnSync(
    'npm',
    ['run', '--silent', 'collaboration:report:check', '--', '-'],
    { cwd: repoRoot, encoding: 'utf8', input: exampleResult.stdout },
  )
  assert.equal(validationResult.status, 0, validationResult.stderr)
  assert.match(validationResult.stdout, /collaboration runtime report passed/)

  const jsonValidationResult = spawnSync(
    'npm',
    ['run', '--silent', 'collaboration:report:check', '--', '--json', '-'],
    { cwd: repoRoot, encoding: 'utf8', input: exampleResult.stdout },
  )
  assert.equal(jsonValidationResult.status, 0, jsonValidationResult.stderr)
  const success = JSON.parse(jsonValidationResult.stdout)
  await validateCollaborationRuntimeValidation(success)
  assert.deepEqual(success, {
    schema: COLLABORATION_RUNTIME_VALIDATION_SCHEMA,
    status: 'passed',
    schemaId: 'https://knowgrph.dev/schemas/collaboration-runtime-report/v1',
    schemaVersion: COLLABORATION_RUNTIME_REPORT_SCHEMA,
    input: 'stdin',
  })

  const invalidExample = JSON.parse(exampleResult.stdout)
  invalidExample.legacyStatus = 'passed'
  const invalidResult = spawnSync(
    'npm',
    ['run', '--silent', 'collaboration:report:check', '--', '-'],
    { cwd: repoRoot, encoding: 'utf8', input: JSON.stringify(invalidExample) },
  )
  assert.notEqual(invalidResult.status, 0)
  assert.match(invalidResult.stderr, /must NOT have additional properties/)

  const invalidJsonResult = spawnSync(
    'npm',
    ['run', '--silent', 'collaboration:report:check', '--', '--json', '-'],
    { cwd: repoRoot, encoding: 'utf8', input: JSON.stringify(invalidExample) },
  )
  assert.notEqual(invalidJsonResult.status, 0)
  assert.equal(invalidJsonResult.stdout, '')
  const failure = JSON.parse(invalidJsonResult.stderr)
  await validateCollaborationRuntimeValidation(failure)
  assert.equal(failure.schema, COLLABORATION_RUNTIME_VALIDATION_SCHEMA)
  assert.equal(failure.status, 'failed')
  assert.equal(failure.input, 'stdin')
  assert.equal(failure.error.code, 'schema-validation-failed')
  assert.match(failure.error.message, /must NOT have additional properties/)

  const malformedJsonResult = spawnSync(
    'npm',
    ['run', '--silent', 'collaboration:report:check', '--', '--json', '-'],
    { cwd: repoRoot, encoding: 'utf8', input: '{' },
  )
  assert.notEqual(malformedJsonResult.status, 0)
  const malformedFailure = JSON.parse(malformedJsonResult.stderr)
  await validateCollaborationRuntimeValidation(malformedFailure)
  assert.equal(malformedFailure.error.code, 'invalid-json')
})

test('validation schema rejects unknown fields and error codes', async () => {
  const failure = {
    schema: COLLABORATION_RUNTIME_VALIDATION_SCHEMA,
    status: 'failed',
    input: 'unknown',
    error: {
      code: 'unknown-error',
      message: 'unexpected failure',
    },
  }
  await assert.rejects(
    validateCollaborationRuntimeValidation(failure),
    /must be equal to one of the allowed values/,
  )

  failure.error.code = 'validation-failed'
  failure.legacyStatus = 'failed'
  await assert.rejects(
    validateCollaborationRuntimeValidation(failure),
    /must NOT have additional properties/,
  )
})

test('report schema rejects unknown fields and mutated workflow checks', async () => {
  const reportWithUnknownField = readLocalReport()
  reportWithUnknownField.legacyStatus = 'passed'
  await assert.rejects(
    validateCollaborationRuntimeReport(reportWithUnknownField),
    /must NOT have additional properties/,
  )

  const reportWithMissingCheck = readLocalReport()
  reportWithMissingCheck.policies.runtimeDocsWorkflow.checks.pop()
  await assert.rejects(
    validateCollaborationRuntimeReport(reportWithMissingCheck),
    /must be equal to constant/,
  )
})

test('artifact validator CLI accepts canonical output and rejects a mutated file', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'knowgrph-collaboration-report-'))
  const artifactPath = path.join(temporaryDirectory, 'collaboration-contract-report.json')
  try {
    const report = readLocalReport()
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`)
    const validResult = spawnSync(
      process.execPath,
      ['scripts/validate-collaboration-runtime-report.mjs', artifactPath],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    assert.equal(validResult.status, 0, validResult.stderr)

    const validJsonResult = spawnSync(
      process.execPath,
      ['scripts/validate-collaboration-runtime-report.mjs', '--json', artifactPath],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    assert.equal(validJsonResult.status, 0, validJsonResult.stderr)
    const success = JSON.parse(validJsonResult.stdout)
    await validateCollaborationRuntimeValidation(success)
    assert.equal(success.input, 'file')

    report.policies.pullRequestCoordination.status = 'unknown'
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`)
    const invalidResult = spawnSync(
      process.execPath,
      ['scripts/validate-collaboration-runtime-report.mjs', artifactPath],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    assert.notEqual(invalidResult.status, 0)
    assert.match(invalidResult.stderr, /invalid knowgrph\.collaboration-runtime-report\/v1/)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})
