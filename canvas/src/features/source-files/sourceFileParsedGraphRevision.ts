export const INITIAL_PARSED_GRAPH_REVISION = 0

export function readParsedGraphRevision(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value < 0) return undefined
  return Math.floor(value)
}

export function readParsedGraphRevisionOrInitial(value: unknown): number {
  return readParsedGraphRevision(value) ?? INITIAL_PARSED_GRAPH_REVISION
}

export function resolveParsedGraphRevision(args: {
  parsedGraphData?: unknown
  previousRevision?: unknown
  preserveExisting?: boolean
}): number | undefined {
  const hasParsedGraphData = !!(args.parsedGraphData && typeof args.parsedGraphData === 'object')
  if (!hasParsedGraphData) return undefined
  if (args.preserveExisting) return readParsedGraphRevisionOrInitial(args.previousRevision)
  return INITIAL_PARSED_GRAPH_REVISION
}

export function incrementParsedGraphRevision(value: unknown): number {
  return readParsedGraphRevisionOrInitial(value) + 1
}
