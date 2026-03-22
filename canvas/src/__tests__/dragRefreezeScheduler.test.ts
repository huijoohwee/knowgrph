import { cancelPendingRefreeze, scheduleSimulationRefreezeAfterDrag } from '@/components/GraphCanvas/dragRefreeze'

export const testDragRefreezeSchedulerSetsFrozen = async () => {
  const attrs = new Map<string, string>()
  const svg =
    ({
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value)
      },
      getAttribute: (name: string) => {
        return attrs.get(name) ?? null
      },
      removeAttribute: (name: string) => {
        attrs.delete(name)
      },
    } as unknown as SVGSVGElement)

  let stopped = false
  const sim = {
    alpha: () => 0,
    alphaTarget: () => sim,
    stop: () => {
      stopped = true
      return sim
    },
  } as unknown as import('d3').Simulation<unknown, import('d3').SimulationLinkDatum<unknown>>

  scheduleSimulationRefreezeAfterDrag({ simulation: sim, svgEl: svg, maxMs: 10, alphaBelow: 0.03 })
  await new Promise<void>(resolve => setTimeout(resolve, 25))
  if (svg.getAttribute('data-kg-layout-frozen') !== '1') throw new Error('Expected SVG to be frozen')
  if (!stopped) throw new Error('Expected simulation to be stopped')

  cancelPendingRefreeze(svg)
}
