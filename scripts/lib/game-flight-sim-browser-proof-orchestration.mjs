import {
  NamedVerificationAggregateError,
  throwForNamedFailures,
} from './named-verification-runner.mjs'

function failure(name, error) {
  return Object.freeze({
    name,
    message: error instanceof Error ? error.message : String(error),
  })
}

export async function runSerialBrowserProof({
  assertExactCandidate,
  clearPriorEvidence,
  executeRun,
  log = console,
  runCount,
  validateRunEvidence,
}) {
  try {
    await assertExactCandidate()
  } catch (error) {
    throw new NamedVerificationAggregateError(
      'Game Flight Sim browser smoke',
      [failure('exact candidate preflight', error)],
    )
  }
  try {
    await clearPriorEvidence()
  } catch (error) {
    throw new NamedVerificationAggregateError(
      'Game Flight Sim browser smoke',
      [failure('prior evidence cleanup', error)],
    )
  }

  const failures = []
  const runs = []
  for (let runIndex = 1; runIndex <= runCount; runIndex += 1) {
    let executed = false
    try {
      log.info?.(`[browser-verification:start] serial run ${runIndex}`)
      await executeRun(runIndex)
      executed = true
      log.info?.(`[browser-verification:pass] serial run ${runIndex}`)
    } catch (error) {
      failures.push(failure(`serial browser run ${runIndex}`, error))
      log.error?.(`[browser-verification:fail] serial run ${runIndex}`)
    }

    if (executed) {
      try {
        runs.push(await validateRunEvidence(runIndex))
      } catch (error) {
        failures.push(failure(`browser evidence run ${runIndex}`, error))
      }
    }

    try {
      await assertExactCandidate()
    } catch (error) {
      failures.push(failure(
        `exact candidate after browser run ${runIndex}`,
        error,
      ))
      break
    }
  }

  throwForNamedFailures('Game Flight Sim browser smoke', failures)
  return Object.freeze(runs)
}
