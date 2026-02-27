import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { JSONValue } from '@/lib/graph/types'
import {
  DEFAULT_DESIGN_WIREFRAME_SETTINGS,
  DESIGN_WIREFRAME_META_KEY,
  readDesignWireframeSettings,
  type DesignWireframeSettings,
} from '@/lib/render/designWireframeSettings'

export function useDesignWireframeSettings(): {
  settings: DesignWireframeSettings
  setSettings: (next: Partial<DesignWireframeSettings>) => void
  resetSettings: () => void
} {
  const { schema, setSchema } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      setSchema: s.setSchema,
    })),
  )

  const settings = React.useMemo((): DesignWireframeSettings => {
    return readDesignWireframeSettings(schema)
  }, [schema])

  const setSettings = React.useCallback(
    (nextPartial: Partial<DesignWireframeSettings>) => {
      const current = schema
      if (!current) return
      const meta =
        current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
          ? (current.metadata as Record<string, JSONValue>)
          : ({} as Record<string, JSONValue>)
      const existingRaw = Object.prototype.hasOwnProperty.call(meta, DESIGN_WIREFRAME_META_KEY)
        ? (meta[DESIGN_WIREFRAME_META_KEY] as unknown)
        : undefined
      const existing =
        existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
          ? (existingRaw as Record<string, JSONValue>)
          : ({} as Record<string, JSONValue>)
      const next: Record<string, JSONValue> = { ...existing }
      const assignBool = (k: keyof DesignWireframeSettings) => {
        if (typeof nextPartial[k] === 'boolean') next[k as string] = nextPartial[k] as unknown as JSONValue
      }
      const assignInt = (k: keyof DesignWireframeSettings, min: number, max: number) => {
        const raw = nextPartial[k]
        if (typeof raw !== 'number' || !Number.isFinite(raw)) return
        next[k as string] = Math.max(min, Math.min(max, Math.floor(raw))) as unknown as JSONValue
      }
      assignBool('showEdges')
      assignBool('showLabelChips')
      assignBool('showMetaChips')
      assignBool('avoidLabelCollisions')
      assignBool('showTextPreview')
      assignBool('showMediaPreview')
      assignBool('depthFade')
      assignInt('maxEdges', 0, 5000)
      assignInt('maxLabelChars', 8, 140)
      setSchema({ ...current, metadata: { ...meta, [DESIGN_WIREFRAME_META_KEY]: next as unknown as JSONValue } })
    },
    [schema, setSchema],
  )

  const resetSettings = React.useCallback(() => {
    const current = schema
    if (!current) return
    const meta =
      current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
        ? (current.metadata as Record<string, JSONValue>)
        : ({} as Record<string, JSONValue>)
    setSchema({
      ...current,
      metadata: { ...meta, [DESIGN_WIREFRAME_META_KEY]: DEFAULT_DESIGN_WIREFRAME_SETTINGS as unknown as JSONValue },
    })
  }, [schema, setSchema])

  return { settings, setSettings, resetSettings }
}
