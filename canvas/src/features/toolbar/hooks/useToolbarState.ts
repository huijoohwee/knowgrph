import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';

export function useToolbarState() {
  return useGraphStore(
    useShallow((s) => ({
      canvasRenderMode: s.canvasRenderMode,
      setCanvasRenderMode: s.setCanvasRenderMode,
      schema: s.schema,
      setSchema: s.setSchema,
      enableLaunchSpotlight: s.enableLaunchSpotlight,
      launchSpotlightMode: s.launchSpotlightMode,
      nodesCount: s.graphData?.nodes?.length ?? 0,
      edgesCount: s.graphData?.edges?.length ?? 0,
      ingestionMetrics: (() => {
        const data = s.graphData;
        if (!data) return null;
        const meta = data.metadata;
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
        const raw = (meta as Record<string, unknown>).ingestionMetrics;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return raw as Record<string, unknown>;
      })(),
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiIconAnimationEnabled: s.uiIconAnimationEnabled,
      uiPanelKeyValueTextSizeClass: s.uiPanelKeyValueTextSizeClass || 'text-xs',
      selectMode: s.schema.behavior?.selectMode ?? 'single',
      setSelectMode: s.setSelectMode,
      isSidebarOpen: s.isSidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      viewPinned: s.viewPinned,
      setViewPinned: s.setViewPinned,
      toggleViewPinned: s.toggleViewPinned,
      fitToScreenMode: s.fitToScreenMode,
      toggleFitToScreenMode: s.toggleFitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      setZoomToSelectionMode: s.setZoomToSelectionMode,
      setFitToScreenMode: s.setFitToScreenMode,
    })),
  );
}
