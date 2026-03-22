import {
  clearGraphCanvasUserInteracted,
  hasGraphCanvasUserInteracted,
  markGraphCanvasUserInteracted,
  resetGraphCanvasUserInteracted,
} from '@/components/GraphCanvas/userInteractionFlag'

export const testGraphCanvasUserInteractionFlagHelpers = () => {
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

  if (hasGraphCanvasUserInteracted(svg)) throw new Error('Expected no interaction at start')
  resetGraphCanvasUserInteracted(svg)
  if (hasGraphCanvasUserInteracted(svg)) throw new Error('Expected reset to be non-interacted')
  markGraphCanvasUserInteracted(svg)
  if (!hasGraphCanvasUserInteracted(svg)) throw new Error('Expected mark to set interacted')
  clearGraphCanvasUserInteracted(svg)
  if (hasGraphCanvasUserInteracted(svg)) throw new Error('Expected clear to remove interacted')

  resetGraphCanvasUserInteracted(undefined)
  markGraphCanvasUserInteracted(null)
  clearGraphCanvasUserInteracted(undefined)
  if (hasGraphCanvasUserInteracted(undefined)) throw new Error('Expected undefined to be non-interacted')
}
