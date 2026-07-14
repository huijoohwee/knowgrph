#!/usr/bin/env node
import { syncDevCanonicalSources } from './sync-dev-canonical-sources.mjs'

try {
  const result = await syncDevCanonicalSources()
  process.stdout.write(`[dev:latest] ${result.message}\n`)
} catch (error) {
  process.stderr.write(`[dev:latest] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
