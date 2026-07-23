const EXTERNAL_PROJECT_IDENTIFIERS = Object.freeze([
  ['Flight', 'Gear'].join(''),
  ['Sim', 'Gear'].join(''),
  ['Arnie', '016'].join(''),
  ['flight', 'simulator', 'fable5'].join('-'),
])

const POLICY_DOCUMENT_PATHS = new Set([
  'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
  'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md',
])

function policyDocumentRetainsNoCopyBoundary(source) {
  const normalized = source.toLowerCase()
  const inspirationOnly = normalized.includes('inspiration only')
  const noCopy = normalized.includes('forbid source copy')
    || normalized.includes('copies none of its source')
  const noDependency = normalized.includes('forbid any runtime/build dependency')
    || normalized.includes('no dependency')
    || normalized.includes('takes no dependency')
  return inspirationOnly && noCopy && noDependency
}

function matchingIdentifiers(value) {
  const normalized = value.toLowerCase()
  return EXTERNAL_PROJECT_IDENTIFIERS
    .filter(identifier => normalized.includes(identifier.toLowerCase()))
}

export function findFlightSimBoundaryViolations(entries) {
  const violations = []
  for (const entry of entries) {
    const relativePath = String(entry.relativePath || '').replaceAll('\\', '/')
    const bytes = Buffer.isBuffer(entry.bytes)
      ? entry.bytes
      : Buffer.from(entry.bytes || entry.source || '', 'utf8')
    const pathMatches = matchingIdentifiers(relativePath)
    if (pathMatches.length > 0) {
      violations.push({
        relativePath,
        identifiers: pathMatches,
        reason: 'tracked path names an inspiration-only external project',
      })
    }
    const source = bytes.toString('utf8')
    const contentMatches = matchingIdentifiers(source)
    if (contentMatches.length === 0) continue
    if (
      POLICY_DOCUMENT_PATHS.has(relativePath)
      && policyDocumentRetainsNoCopyBoundary(source)
    ) {
      continue
    }
    violations.push({
      relativePath,
      identifiers: contentMatches,
      reason: 'tracked content names an inspiration-only external project',
    })
  }
  return violations
}

export function assertFlightSimBoundary(entries) {
  const violations = findFlightSimBoundaryViolations(entries)
  if (violations.length === 0) return
  const details = violations.map(violation => (
    `${violation.relativePath}: ${violation.reason} (${violation.identifiers.join(', ')})`
  ))
  throw new Error(
    `Flight Sim no-copy/dependency boundary failed:\n${details.join('\n')}`,
  )
}
