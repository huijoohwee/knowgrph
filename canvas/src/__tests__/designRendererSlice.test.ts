import { designFramePosEq, designFrameSizeEq } from '@/hooks/store/designRendererSlice'

export function testDesignFramePosEqDetectsEquality() {
  if (!designFramePosEq({ x: 1, y: 2 }, { x: 1, y: 2 })) throw new Error('expected equal positions')
  if (designFramePosEq({ x: 1, y: 2 }, { x: 2, y: 2 })) throw new Error('expected unequal x')
  if (designFramePosEq({ x: 1, y: 2 }, { x: 1, y: 3 })) throw new Error('expected unequal y')
  if (designFramePosEq(null, { x: 1, y: 2 })) throw new Error('expected null vs value to be unequal')
  if (designFramePosEq({ x: 1, y: 2 }, null)) throw new Error('expected value vs null to be unequal')
}

export function testDesignFrameSizeEqDetectsEquality() {
  if (!designFrameSizeEq({ w: 10, h: 20 }, { w: 10, h: 20 })) throw new Error('expected equal sizes')
  if (designFrameSizeEq({ w: 10, h: 20 }, { w: 11, h: 20 })) throw new Error('expected unequal w')
  if (designFrameSizeEq({ w: 10, h: 20 }, { w: 10, h: 21 })) throw new Error('expected unequal h')
  if (designFrameSizeEq(null, { w: 10, h: 20 })) throw new Error('expected null vs value to be unequal')
  if (designFrameSizeEq({ w: 10, h: 20 }, null)) throw new Error('expected value vs null to be unequal')
}
