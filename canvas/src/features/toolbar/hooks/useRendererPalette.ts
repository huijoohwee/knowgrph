import React from 'react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema';
import type { JSONValue } from '@/lib/graph/types';
import { useShallow } from 'zustand/react/shallow';

export function useRendererPalette() {
  const { schema, setSchema } = useGraphStore(
    useShallow((s) => ({
      schema: s.schema,
      setSchema: s.setSchema,
    }))
  );

  const palette = React.useMemo(() => {
    const meta =
      schema.metadata && typeof schema.metadata === 'object' && !Array.isArray(schema.metadata)
        ? schema.metadata
        : {};
    const raw = Object.prototype.hasOwnProperty.call(meta, 'renderer:palette')
      ? (meta['renderer:palette'] as unknown)
      : undefined;
    const baseNodes = MVP_COLOR_PALETTE.nodes;
    const baseEdges = MVP_COLOR_PALETTE.edges;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as { nodes?: Record<string, string>; edges?: Record<string, string> };
      return {
        nodes: { ...baseNodes, ...(obj.nodes || {}) },
        edges: { ...baseEdges, ...(obj.edges || {}) },
      };
    }
    return { nodes: baseNodes, edges: baseEdges };
  }, [schema]);

  const handleUpdatePaletteColor = React.useCallback(
    (kind: 'node' | 'edge', key: string, value: string) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      const current = schema;
      const meta =
        current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
          ? (current.metadata as Record<string, JSONValue>)
          : ({} as Record<string, JSONValue>);
      const existingRaw = Object.prototype.hasOwnProperty.call(meta, 'renderer:palette')
        ? (meta['renderer:palette'] as unknown)
        : undefined;
      const existing =
        existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
          ? (existingRaw as { nodes?: Record<string, string>; edges?: Record<string, string> })
          : { nodes: {}, edges: {} };
      const nextNodes: Record<string, string> = { ...(existing.nodes || {}) };
      const nextEdges: Record<string, string> = { ...(existing.edges || {}) };
      if (kind === 'node') {
        nextNodes[key] = trimmed;
      } else {
        nextEdges[key] = trimmed;
      }
      const nextPalette: { nodes?: Record<string, string>; edges?: Record<string, string> } = {
        ...existing,
        nodes: nextNodes,
        edges: nextEdges,
      };
      const nextSchema = {
        ...current,
        metadata: {
          ...meta,
          'renderer:palette': nextPalette as JSONValue,
        },
      };
      setSchema(nextSchema);
    },
    [schema, setSchema]
  );

  const normalizeColorForPicker = (raw: string, fallback: string) => {
    const v = String(raw || '').trim() || fallback;
    if (!v.startsWith('#')) return '#000000';
    if (v.length === 4 || v.length === 7) return v;
    return '#000000';
  };

  return {
    palette,
    handleUpdatePaletteColor,
    normalizeColorForPicker,
  };
}
