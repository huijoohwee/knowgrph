export type GraphGroup = {
  id: string
  label: string
  depth: number
  xIndex?: number
  zIndex?: number
  zMode?: 'group' | 'absolute'
  yIndex?: number
  memberNodeIds: string[]
  style: {
    fill?: string
    stroke?: string
    strokeWidth?: number
  }
  bounds?: {
    x: number
    y: number
    width: number
    height: number
    labelX?: number
    labelY?: number
  }
}
