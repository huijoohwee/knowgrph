
import { PackedRTree } from './rTree'
import type { BoxItem } from './types'

export type { BoxItem }

export class SpatialIndex<T extends BoxItem> extends PackedRTree<T> {
  constructor(items: T[]) {
    super(items)
  }
}
