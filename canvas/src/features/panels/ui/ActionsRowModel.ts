export type Action = {
  label: string
  onClick: () => void | Promise<void>
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  spotlightId?: string
}

