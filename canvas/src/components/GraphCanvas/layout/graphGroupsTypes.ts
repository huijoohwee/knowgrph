export type GraphGroup = {
  id: string
  label: string
  depth: number
  xIndex?: number
  yIndex?: number
  memberNodeIds: string[]
  style: {
    fill?: string
    stroke?: string
    strokeWidth?: number
  }
}

