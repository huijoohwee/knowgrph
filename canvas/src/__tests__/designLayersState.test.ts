import { moveDesignLayer, normalizeDesignLayerState, toggleDesignLayerHidden } from '@/features/design/designLayersState'

export function testDesignLayersNormalizePreservesOrderAndAddsNew() {
  const prev = { order: ['b', 'a'], hiddenById: { a: true, b: false, c: true } }
  const nodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]
  const next = normalizeDesignLayerState({ prev, nodes })
  const sig = next.order.join(',')
  if (sig !== 'b,a,c') throw new Error(`expected order to preserve + append; got ${sig}`)
  if (next.hiddenById.a !== true) throw new Error('expected a to stay hidden')
  if (next.hiddenById.b !== false) throw new Error('expected b to stay visible')
  if (next.hiddenById.c !== true) throw new Error('expected c hidden state to be preserved')
}

export function testDesignLayersToggleAndMove() {
  const hidden0 = { a: true }
  const hidden1 = toggleDesignLayerHidden(hidden0, 'a')
  if (hidden1.a !== false) throw new Error('expected a to toggle off')
  const hidden2 = toggleDesignLayerHidden(hidden1, 'b')
  if (hidden2.b !== true) throw new Error('expected b to toggle on')

  const order0 = ['a', 'b', 'c']
  const orderUp = moveDesignLayer({ order: order0, id: 'b', dir: 'up' })
  if (orderUp.join(',') !== 'b,a,c') throw new Error(`expected move up; got ${orderUp.join(',')}`)
  const orderDown = moveDesignLayer({ order: orderUp, id: 'b', dir: 'down' })
  if (orderDown.join(',') !== 'a,b,c') throw new Error(`expected move down; got ${orderDown.join(',')}`)
}

