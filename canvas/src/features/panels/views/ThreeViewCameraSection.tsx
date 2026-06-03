import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  CAMERA_DAMPING_TOOLTIP,
  ROTATE_SPEED_TOOLTIP,
  ZOOM_SPEED_TOOLTIP,
  PAN_SPEED_TOOLTIP,
  AUTO_ROTATE_SPEED_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_SMALL_SELECTION_CONTROL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

interface ThreeViewCameraSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
}

export default function ThreeViewCameraSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
}: ThreeViewCameraSectionProps) {
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)
  const voxelModeActive = canvasRenderMode === '3d' && canvas3dMode === 'voxel'
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary
  const selectionControlClassName = `${UI_RESPONSIVE_SMALL_SELECTION_CONTROL_CLASSNAME} rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`
  return (
    <CollapsibleSection
      title="Camera and navigation"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Camera Damping</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={Number(schema.three?.cameraDampingFactor ?? 0.08)}
                onChange={e =>
                  setThreeConfig({ cameraDampingFactor: Number(e.target.value) })
                }
              />
              <Tooltip
                content={CAMERA_DAMPING_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.cameraDampingFactor ?? 0.08)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Rotate Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={Number(schema.three?.cameraRotateSpeed ?? 0.6)}
                onChange={e =>
                  setThreeConfig({ cameraRotateSpeed: Number(e.target.value) })
                }
              />
              <Tooltip
                content={ROTATE_SPEED_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.cameraRotateSpeed ?? 0.6)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Zoom Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.2}
                max={2}
                step={0.05}
                value={Number(schema.three?.cameraZoomSpeed ?? 0.8)}
                onChange={e =>
                  setThreeConfig({ cameraZoomSpeed: Number(e.target.value) })
                }
              />
              <Tooltip
                content={ZOOM_SPEED_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.cameraZoomSpeed ?? 0.8)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Pan Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={Number(schema.three?.cameraPanSpeed ?? 0.5)}
                onChange={e =>
                  setThreeConfig({ cameraPanSpeed: Number(e.target.value) })
                }
              />
              <Tooltip
                content={PAN_SPEED_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.cameraPanSpeed ?? 0.5)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Auto Rotate</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={Boolean(schema.three?.cameraAutoRotate ?? false)}
              disabled={voxelModeActive}
              onChange={e =>
                setThreeConfig({ cameraAutoRotate: e.target.checked })
              }
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Auto Rotate Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={Number(schema.three?.cameraAutoRotateSpeed ?? 0.4)}
                disabled={voxelModeActive}
                onChange={e =>
                  setThreeConfig({ cameraAutoRotateSpeed: Number(e.target.value) })
                }
              />
              <Tooltip
                content={AUTO_ROTATE_SPEED_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.cameraAutoRotateSpeed ?? 0.4)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </div>
    </CollapsibleSection>
  )
}
