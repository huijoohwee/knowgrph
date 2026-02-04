
export interface BoxItem {
  cx: number
  cy: number
  cz?: number // Optional Z center
  halfW: number
  halfH: number
  halfD?: number // Optional Z half-extent
  id?: string | number
}

export interface MovableNode {
  vx?: number
  vy?: number
  vz?: number
}
