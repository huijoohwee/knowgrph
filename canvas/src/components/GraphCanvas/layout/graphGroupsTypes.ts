export type GraphGroup = {
  id: string
  label: string
  depth: number
  memberNodeIds: string[]
  style: {
    fill?: string
    stroke?: string
    strokeWidth?: number
  }
}

