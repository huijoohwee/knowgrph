import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';

export function useToolbarState() {
  return useGraphStore(
    useShallow((s) => ({
      canvasRenderMode: s.canvasRenderMode,
      setCanvasRenderMode: s.setCanvasRenderMode,
      schema: s.schema,
      setSchema: s.setSchema,
      graphLayersVisible: s.graphLayersVisible,
      toggleGraphLayersVisible: s.toggleGraphLayersVisible,
      enableLaunchSpotlight: s.enableLaunchSpotlight,
      launchSpotlightMode: s.launchSpotlightMode,
      nodesCount: s.graphData?.nodes?.length ?? 0,
      edgesCount: s.graphData?.edges?.length ?? 0,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiIconAnimationEnabled: s.uiIconAnimationEnabled,
      uiPanelKeyValueTextSizeClass: s.uiPanelKeyValueTextSizeClass || 'text-xs',
      selectMode: s.schema.behavior?.selectMode ?? 'single',
      setSelectMode: s.setSelectMode,
      isSidebarOpen: s.isSidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      fitToScreenMode: s.fitToScreenMode,
      toggleFitToScreenMode: s.toggleFitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      setZoomToSelectionMode: s.setZoomToSelectionMode,
      setFitToScreenMode: s.setFitToScreenMode,
    })),
  );
}
