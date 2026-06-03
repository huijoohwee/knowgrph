import { CanvasArrangeActionBar } from '@/components/canvas/CanvasArrangeActionBar'
import type { ArrangeAction2d } from '@/lib/canvas/arrange2d'

export function ArrangeToolbar2d(props: {
  active: boolean
  selectedCount: number
  onArrange: (action: ArrangeAction2d) => void
}) {
  const { active, selectedCount, onArrange } = props
  return (
    <CanvasArrangeActionBar
      active={active}
      selectedCount={selectedCount}
      onArrange={onArrange}
      ariaLabel="Arrange selected graph nodes"
    />
  )
}
