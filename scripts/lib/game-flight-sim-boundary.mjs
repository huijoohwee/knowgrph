const EXTERNAL_PROJECT_IDENTIFIERS = Object.freeze([
  ['Flight', 'Gear'].join(''),
  ['Sim', 'Gear'].join(''),
  ['Arnie', '016'].join(''),
  ['flight', 'simulator', 'fable5'].join('-'),
])

const KIRO_POLICY_DOCUMENT_PATHS = Object.freeze([
  '.kiro/specs/knowgrph-game-flight-sim/.config.kiro',
  '.kiro/specs/knowgrph-game-flight-sim/requirements.md',
  '.kiro/specs/knowgrph-game-flight-sim/design.md',
  '.kiro/specs/knowgrph-game-flight-sim/tasks.md',
])

const POLICY_DOCUMENT_PATHS = new Set([
  'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
  'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md',
  ...KIRO_POLICY_DOCUMENT_PATHS,
])

function policyDocumentRetainsNoCopyBoundary(source) {
  const normalized = source.toLowerCase()
  const inspirationOnly = normalized.includes('inspiration only')
    || normalized.includes('concepts and architecture')
  const provenance = normalized.includes('source-authored')
    && (normalized.includes('attest') || normalized.includes('provenance attestation'))
  const namedScope = normalized.includes('named')
    && normalized.includes('identity')
    && normalized.includes('path')
    && normalized.includes('content')
    && normalized.includes('binary/asset')
    && normalized.includes('dependency')
  const boundedGate = (
    normalized.includes('cannot prove the absence of arbitrary derived code')
    || normalized.includes('unable to prove the absence of arbitrary derived code')
    || normalized.includes('does not prove the absence of arbitrary derived code')
    || normalized.includes('does not claim to prove the absence of arbitrary derived code')
  )
  const noDependency = normalized.includes('forbid any runtime/build dependency')
    || normalized.includes('no dependency')
    || normalized.includes('takes no dependency')
    || normalized.includes('zero external-project dependency')
    || normalized.includes('zero build-time, external, or runtime dependency')
  return inspirationOnly && provenance && namedScope && boundedGate && noDependency
}

function matchingIdentifiers(value) {
  const normalized = value.toLowerCase()
  return EXTERNAL_PROJECT_IDENTIFIERS
    .filter(identifier => normalized.includes(identifier.toLowerCase()))
}

function isBinary(bytes) {
  if (bytes.includes(0)) return true
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return false
  } catch {
    return true
  }
}

function isExecutableOrDependencyLine(line, identifiers) {
  const escaped = identifiers
    .map(identifier => identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const identity = new RegExp(`(?:${escaped})`, 'i')
  if (!identity.test(line)) return false
  return (
    /^\s*(?:import|export)\b/.test(line)
    || /\brequire\s*\(/.test(line)
    || /\bimport\s*\(/.test(line)
    || /\b(?:const|let|var)\b/.test(line)
    || new RegExp(`(?:${escaped})\\.[A-Za-z_$]`, 'i').test(line)
    || new RegExp(`(?:${escaped})\\(`, 'i').test(line)
    || new RegExp(`\\bnew\\s+(?:${escaped})\\b`, 'i').test(line)
    || new RegExp(`(?:${escaped})\\s*:\\s*["'][^"']+["']`, 'i').test(line)
    || new RegExp(`["'](?:${escaped})["']\\s*:\\s*["']`, 'i').test(line)
  )
}

function isExplicitNeutralPolicyLine(line) {
  const normalized = line.toLowerCase()
  return [
    'inspiration',
    'concepts and architecture',
    'source-authored',
    'provenance',
    'reference',
    'boundary',
    'forbid',
    'shall not include',
    'zero build-time',
    'zero external-project dependency',
    'named-contamination',
    'named identity',
    'scan',
    'scanner',
    'dependency-gate',
    'prohibited',
  ].some(marker => normalized.includes(marker))
}

function policyContentViolation(relativePath, bytes, source, contentMatches) {
  if (!policyDocumentRetainsNoCopyBoundary(source)) {
    return {
      relativePath,
      identifiers: contentMatches,
      reason: 'canonical policy file lacks honest named-contamination/provenance markers',
    }
  }
  if (isBinary(bytes)) {
    return {
      relativePath,
      identifiers: contentMatches,
      reason: 'canonical policy file contains binary external-project content',
    }
  }
  for (const line of source.split(/\r?\n/)) {
    const lineMatches = matchingIdentifiers(line)
    if (lineMatches.length === 0) continue
    if (isExecutableOrDependencyLine(line, lineMatches)) {
      return {
        relativePath,
        identifiers: lineMatches,
        reason: 'canonical policy file contains an executable or package-dependency external-project reference',
      }
    }
    if (!isExplicitNeutralPolicyLine(line)) {
      return {
        relativePath,
        identifiers: lineMatches,
        reason: 'external-project identity appears outside an explicit neutral policy/reference line',
      }
    }
  }
  return null
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
    if (POLICY_DOCUMENT_PATHS.has(relativePath)) {
      const policyViolation = policyContentViolation(
        relativePath,
        bytes,
        source,
        contentMatches,
      )
      if (!policyViolation) continue
      violations.push(policyViolation)
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
    `Flight Sim named-contamination/provenance boundary failed:\n${details.join('\n')}`,
  )
}
