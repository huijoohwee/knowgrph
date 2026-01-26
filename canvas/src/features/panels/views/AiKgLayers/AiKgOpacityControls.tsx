import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  AI_KG_LAYER1_OPACITY_ROW_TOOLTIP,
  AI_KG_LAYER2_OPACITY_ROW_TOOLTIP,
  AI_KG_LAYER3_OPACITY_ROW_TOOLTIP,
} from '@/lib/config'
import {
  LAYER1_OPACITY_TOOLTIP,
  LAYER2_OPACITY_TOOLTIP,
  LAYER3_OPACITY_TOOLTIP,
} from '../AiKgLayersSectionTooltips'

type AiKgOpacityControlsProps = {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgOpacityControls({
  schema,
  setThreeConfig,
  uiPanelKeyValueInputClass,
}: AiKgOpacityControlsProps) {
  const three = getThreeConfig(schema)
  const layerOpacityByLayer = (three.layerOpacityByLayer || {}) as Record<string, number>

  const getLayerOpacityValue = (layer: '1' | '2' | '3', fallback: number) => {
    const v = layerOpacityByLayer[layer]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }

  const layer1 = getLayerOpacityValue('1', 1.0)
  const layer2 = getLayerOpacityValue('2', 0.9)
  const layer3 = getLayerOpacityValue('3', 0.8)

  return (
    <>
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_LAYER1_OPACITY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            three.layerOpacityByLayer['1']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER1_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer1)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 1
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': quantized,
                    '2': layer2,
                    '3': layer3,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER1_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer1.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 1
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': quantized,
                    '2': layer2,
                    '3': layer3,
                  },
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_LAYER2_OPACITY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            three.layerOpacityByLayer['2']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER2_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer2)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.9
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': quantized,
                    '3': layer3,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER2_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer2.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.9
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': quantized,
                    '3': layer3,
                  },
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_LAYER3_OPACITY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            three.layerOpacityByLayer['3']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER3_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer3)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.8
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': layer2,
                    '3': quantized,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER3_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer3.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.8
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': layer2,
                    '3': quantized,
                  },
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
    </>
  )
}
