type RunTextProviderResponseArgs = {
  payload: unknown
  extractText: (payload: unknown) => string
  onText?: (text: string) => void
}

const readRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
)

export class RunTextProviderIncompleteError extends Error {
  readonly reason: string

  constructor(reason: string) {
    const normalizedReason = String(reason || '').trim()
    super(`Run text provider returned an incomplete response${normalizedReason ? ` (${normalizedReason})` : ''}.`)
    this.name = 'RunTextProviderIncompleteError'
    this.reason = normalizedReason
  }
}

export function readRunTextProviderIncompleteReason(payload: unknown): string | null {
  const event = readRecord(payload)
  const response = readRecord(event.response)
  const status = String(response.status || event.status || '').trim().toLowerCase()
  const eventType = String(event.type || '').trim().toLowerCase()
  if (status !== 'incomplete' && eventType !== 'response.incomplete') return null
  const details = readRecord(response.incomplete_details || event.incomplete_details)
  return String(details.reason || '').trim()
}

export function readRunTextProviderResponse(args: RunTextProviderResponseArgs): string {
  const incompleteReason = readRunTextProviderIncompleteReason(args.payload)
  if (incompleteReason !== null) throw new RunTextProviderIncompleteError(incompleteReason)

  const text = args.extractText(args.payload)
  if (!text) throw new Error('Run text provider returned no extractable content.')
  args.onText?.(text)
  return text
}
