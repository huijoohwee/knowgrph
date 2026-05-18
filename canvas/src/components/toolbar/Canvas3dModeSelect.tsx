import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Box, Columns2, Cuboid, Glasses } from 'lucide-react'
import type { Canvas3dModeId } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getVoxelModeInapplicableReason, isVoxelModeApplicable } from '@/lib/canvas/canvas3dMode'
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
  id: '2d' | Canvas3dModeId
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
  const voxelApplicable = isVoxelModeApplicable({
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    geospatialEnabled,
    schema,
  })
  const inapplicableReason = getVoxelModeInapplicableReason({
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    geospatialEnabled,
    schema,
  })
  const disabledReason = React.useMemo(() => {
    if (inapplicableReason === 'geospatial') {
      return {
        reason: 'Disabled in Geospatial Mode',
        hint: 'Switch to Document Mode to enable',
      }
    }
    if (inapplicableReason === 'renderer') {
      return {
        reason: 'Requires 2D Renderer: D3 Flowchart',
        hint: 'Switch 2D Renderer to D3 Flowchart',
      }
    }
    if (inapplicableReason === 'semantic') {
      return {
        reason: 'Voxel Mode requires Document/Keyword, Frontmatter, or Multi-dimensional Table mode',
        hint: 'Enable one semantic mode, then retry',
      }
    }
    if (inapplicableReason === 'layout') {
      return {
        reason: 'Voxel Mode is disabled in Radial Layout',
        hint: 'Set layout mode to Block',
      }
    }
    return null
  }, [inapplicableReason])
  const threeDisabledReason = React.useMemo(() => {
    if (schema?.layout?.mode === 'radial') {
      return {
        reason: '3D Mode is disabled in Radial Layout',
        hint: 'Set layout mode to Block',
      }
    }
    return null
  }, [schema])
  const options = React.useMemo(
    () =>
      [
        { id: '2d', title: '2D Mode', label: '2D', Icon: Columns2 },
        {
          id: '3d',
          title: '3D Mode',
          label: '3D',
          Icon: Box,
          disabled: !!threeDisabledReason,
          disabledReason: threeDisabledReason?.reason,
          enableHint: threeDisabledReason?.hint,
        },
        {
          id: 'xr',
          title: 'XR Mode',
          label: 'XR',
          Icon: Glasses,
          disabled: !!threeDisabledReason,
          disabledReason: threeDisabledReason?.reason,
          enableHint: threeDisabledReason?.hint,
        },
        {
          id: 'voxel',
          title: 'Voxel Mode',
          label: 'Voxel',
          Icon: Cuboid,
          disabled: !schema,
          disabledReason: !schema ? 'Graph schema is not ready yet' : !voxelApplicable ? disabledReason?.reason : undefined,
          enableHint: !schema ? 'Wait for graph initialization, then retry' : !voxelApplicable ? disabledReason?.hint : undefined,
        },
      ] satisfies ThreeModeOption[],
    [disabledReason?.hint, disabledReason?.reason, schema, threeDisabledReason, voxelApplicable],
  )
  const selectedModeId = (canvasRenderMode === '3d' ? canvas3dMode : '2d') as ThreeModeOption['id']

  return (
    <ToolbarDropdownSelect
      value={selectedModeId}
      options={options}
      title={canvasRenderMode === '3d' ? options.find(o => o.id === canvas3dMode)?.title || '3D Mode' : '3D Mode'}
      tooltipContent="3D Mode: switch between default 3D and Voxel rendering"
      disabled={disabled}
      isButtonActive={canvasRenderMode === '3d'}
      onSelect={id => {
        if (!ensureBaselineUnlocked()) return
        if (id === '2d') {
          setCanvasRenderMode('2d')
          return
        }
        if (id === 'voxel') {
          if (geospatialEnabled) {
            onOpenGeospatialMode()
            return
          }
          if (schema && schema.layout?.mode !== 'block') {
            setSchema({
              ...schema,
              layout: {
                ...(schema.layout || {}),
                mode: 'block',
              },
            })
          }
          if (canvas2dRenderer !== 'flowchart') {
            setCanvas2dRenderer('flowchart')
          }
          setCanvas3dMode('voxel')
          setCanvasRenderMode('3d')
          return
        }
        setCanvasRenderMode('3d')
        setCanvas3dMode(id)
      }}
      renderButtonContent={activeOption => (
        <div className="flex items-center gap-1">
          <activeOption.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">{activeOption.label}</span>
        </div>
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
