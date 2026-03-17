export function createCandidateId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`
}

export function createUniqueGraphDataTableId(prefix: string, used: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const next = createCandidateId(prefix)
    if (!used.has(next)) return next
  }
  return createCandidateId(prefix)
}

