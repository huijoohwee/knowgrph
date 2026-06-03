import { CanvasArrangeActionBar } from '@/components/canvas/CanvasArrangeActionBar'
import type { DesignCanvasArrangeAction } from '@/components/DesignCanvas/arrangeActions'

export function DesignCanvasArrangeActionBar(props: {
  active: boolean
  selectedCount: number
  onAction: (action: DesignCanvasArrangeAction) => void
}) {
  const { active, selectedCount, onAction } = props
  return (
    <CanvasArrangeActionBar
      active={active}
      selectedCount={selectedCount}
      onArrange={onAction}
      ariaLabel="Arrange selected design frames"
    />
  )
}
