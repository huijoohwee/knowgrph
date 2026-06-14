import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Box, Columns2, Cuboid, Glasses } from 'lucide-react'
import type { Canvas3dModeId } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  applyCanvasSurfaceModeSelection,
  getCanvasSurfaceModeDisabledCopy,
  type CanvasSurfaceModeId,
} from '@/lib/canvas/canvas3dMode'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'

type Canvas3dModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
  geospatialEnabled: boolean
  onOpenGeospatialMode: () => void
  disabled?: boolean
}

type ThreeModeOption = {
  id: CanvasSurfaceModeId
  title: string
  label: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  disabled?: boolean
  disabledReason?: string
  enableHint?: string
}

export function Canvas3dModeSelect({
  iconSizeClass,
  iconStrokeWidth,
  ensureBaselineUnlocked,
  geospatialEnabled,
  onOpenGeospatialMode,
  disabled,
}: Canvas3dModeSelectProps) {
  const { canvasRenderMode, canvas3dMode, setCanvasRenderMode, setCanvas3dMode, setCanvas2dRenderer, setSchema, canvas2dRenderer, documentSemanticMode, frontmatterModeEnabled, multiDimTableModeEnabled, schema } =
    useGraphStore(
      useShallow(s => ({
        canvasRenderMode: s.canvasRenderMode,
        canvas3dMode: s.canvas3dMode,
        setCanvasRenderMode: s.setCanvasRenderMode,
        setCanvas3dMode: s.setCanvas3dMode,
        setCanvas2dRenderer: s.setCanvas2dRenderer,
        setSchema: s.setSchema,
        canvas2dRenderer: s.canvas2dRenderer,
        documentSemanticMode: s.documentSemanticMode,
        frontmatterModeEnabled: s.frontmatterModeEnabled === true,
        multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
        schema: s.schema,
      })),
    )
  const surfaceModeArgs = React.useMemo(
    () => ({
      canvas2dRenderer,
      documentSemanticMode,
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      geospatialEnabled,
      schema,
    }),
    [
      canvas2dRenderer,
      documentSemanticMode,
      frontmatterModeEnabled,
      geospatialEnabled,
      multiDimTableModeEnabled,
      schema,
    ],
  )
  const options = React.useMemo(
    () => {
      const specs = [
        { id: '2d', title: '2D Mode', label: '2D', Icon: Columns2 },
        { id: '3d', title: '3D Mode', label: '3D', Icon: Box },
        { id: 'xr', title: 'XR Mode', label: 'XR', Icon: Glasses },
        { id: 'voxel', title: 'Voxel Mode', label: 'Voxel', Icon: Cuboid },
      ] satisfies Array<Omit<ThreeModeOption, 'disabled' | 'disabledReason' | 'enableHint'>>
      return specs.map(spec => {
        const disabledCopy = getCanvasSurfaceModeDisabledCopy(surfaceModeArgs, spec.id)
        return {
          ...spec,
          disabled: !!disabledCopy,
          disabledReason: disabledCopy?.reason,
          enableHint: disabledCopy?.hint,
        } satisfies ThreeModeOption
      })
    },
    [surfaceModeArgs],
  )
  const selectedModeId = (canvasRenderMode === '3d' ? canvas3dMode : '2d') as ThreeModeOption['id']

  return (
    <ToolbarDropdownSelect
      value={selectedModeId}
      options={options}
      title={canvasRenderMode === '3d' ? options.find(o => o.id === canvas3dMode)?.title || '3D Mode' : '3D Mode'}
      tooltipContent="3D Mode: switch between default 3D, XR, and Voxel rendering"
      disabled={disabled}
      isButtonActive={canvasRenderMode === '3d'}
      onSelect={id => {
        if (!ensureBaselineUnlocked()) return
        applyCanvasSurfaceModeSelection({
          ...surfaceModeArgs,
          mode: id,
          onOpenGeospatialMode,
          setCanvas2dRenderer,
          setCanvas3dMode,
          setCanvasRenderMode,
          setSchema,
        })
      }}
      renderButtonContent={activeOption => (
        <section className="flex items-center gap-1">
          <activeOption.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">{activeOption.label}</span>
        </section>
      )}
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
        </>
      )}
    />
  )
}
