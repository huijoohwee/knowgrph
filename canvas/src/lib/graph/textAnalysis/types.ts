export type TextEntityLabel = string

export type TextEntity = {
  text: string
  label: TextEntityLabel
  start: number
  end: number
}

export type TextTriple = {
  subject: string
  predicate: string
  object: string
  confidence: number
  properties?: Record<string, unknown>
}
