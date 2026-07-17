type RunTextProviderResponseArgs = {
  payload: unknown
  extractText: (payload: unknown) => string
  onText?: (text: string) => void
}

const readRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
)

export function readRunTextProviderResponse(args: RunTextProviderResponseArgs): string {
  const response = readRecord(args.payload)
  if (String(response.status || '').trim().toLowerCase() === 'incomplete') {
    const incompleteReason = String(readRecord(response.incomplete_details).reason || '').trim()
    throw new Error(`Run text provider returned an incomplete response${incompleteReason ? ` (${incompleteReason})` : ''}.`)
  }

  const text = args.extractText(args.payload)
  if (!text) throw new Error('Run text provider returned no extractable content.')
  args.onText?.(text)
  return text
}
