import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3LabelCollisionReusesFlowStyle() {
  const sceneHandlers = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.ts'), 'utf8')
  if (sceneHandlers.includes('nodeLabelNudgeById')) {
    throw new Error('expected node label relax/nudge map to be removed in favor of placement+culling')
  }
  if (!sceneHandlers.includes('data-collide-hidden')) {
    throw new Error('expected D3 node labels to support collision-based hiding')
  }

  const flowRt = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'nativeRuntime.ts'), 'utf8')
  if (flowRt.includes('type AabbRect = { x: number; y: number; halfW: number; halfH: number }')) {
    throw new Error('expected Flow runtime to reuse shared AABB utils (no local AabbRect type)')
  }
  if (!flowRt.includes("from '@/lib/ui/labels/aabb'")) {
    throw new Error('expected Flow runtime to import shared AABB utils')
  }

  const edgeUtils = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'utils.ts'), 'utf8')
  if (edgeUtils.includes('const aabbOverlaps =')) {
    throw new Error('expected GraphCanvas layout utils to reuse shared AABB overlap')
  }
  if (!edgeUtils.includes("from '@/lib/ui/labels/aabb'")) {
    throw new Error('expected GraphCanvas layout utils to import shared AABB overlap')
  }
}
