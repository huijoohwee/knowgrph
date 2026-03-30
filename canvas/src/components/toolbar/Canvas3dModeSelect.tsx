import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Box, Columns2, Cuboid } from 'lucide-react'
import type { Canvas3dModeId } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isVoxelModeApplicable } from '@/lib/canvas/canvas3dMode'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'

type Canvas3dModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
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

export function Canvas3dModeSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked, disabled }: Canvas3dModeSelectProps) {
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
    schema,
  })
  const disabledReason = React.useMemo(() => {
    if (canvas2dRenderer !== 'd3Bipartite') {
      return {
        reason: 'Requires 2D Renderer: D3 Bipartite',
        hint: 'Switch 2D Renderer to D3 Bipartite',
      }
    }
    if (schema?.layout?.mode !== 'block') {
      return {
        reason: 'Voxel Mode is disabled in Radial Layout',
        hint: 'Set layout mode to Block',
      }
    }
    return null
  }, [canvas2dRenderer, schema?.layout?.mode])
  const options = React.useMemo(
    () =>
      [
        { id: '2d', title: '2D Mode', label: '2D', Icon: Columns2 },
        { id: '3d', title: '3D Mode', label: '3D', Icon: Box },
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
    [disabledReason?.hint, disabledReason?.reason, schema, voxelApplicable],
  )
  const selectedModeId = (canvasRenderMode === '3d' ? canvas3dMode : '2d') as ThreeModeOption['id']

  return (
    <ToolbarDropdownSelect
      value={selectedModeId}
      options={options}
      title={canvasRenderMode === '3d' ? `${options.find(o => o.id === canvas3dMode)?.title || '3D Mode'} (On)` : '3D Mode (Off)'}
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
          if (schema && schema.layout?.mode !== 'block') {
            setSchema({
              ...schema,
              layout: {
                ...(schema.layout || {}),
                mode: 'block',
              },
            })
          }
          if (canvas2dRenderer !== 'd3Bipartite') {
            setCanvas2dRenderer('d3Bipartite')
          }
          const schedule = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
          let attempts = 0
          const applyVoxelWhenReady = () => {
            attempts += 1
            const s = useGraphStore.getState()
            const applicable = isVoxelModeApplicable({
              canvas2dRenderer: s.canvas2dRenderer,
              documentSemanticMode: s.documentSemanticMode,
              frontmatterModeEnabled: s.frontmatterModeEnabled === true,
              multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
              schema: s.schema,
            })
            if (applicable || attempts >= 12) {
              s.setCanvas3dMode('voxel')
              s.setCanvasRenderMode('3d')
              return
            }
            schedule(applyVoxelWhenReady)
          }
          schedule(applyVoxelWhenReady)
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
