export interface ParserDetectionStatus {
  hasSelectedSpec: boolean
  attemptedAutoDetect: boolean
  inputText: string
  warnings: string[]
}

export interface ParserSelectionSectionProps {
  parsersCollapsed: boolean
  onParsersCollapsedChange: (collapsed: boolean) => void
  detection: ParserDetectionStatus
  embedded?: boolean
}

export interface ParserDataSectionProps {
  inputCollapsed: boolean
  onInputCollapsedChange: (collapsed: boolean) => void
  embedded?: boolean
  showMetrics?: boolean
}
