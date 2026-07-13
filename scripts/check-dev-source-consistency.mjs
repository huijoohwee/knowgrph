#!/usr/bin/env node
import { checkDevSourceConsistency } from './dev-source-consistency.mjs'

try {
  const result = await checkDevSourceConsistency()
  process.stdout.write(`[dev:source] ${result.message}\n`)
} catch (error) {
  process.stderr.write(`[dev:source] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
