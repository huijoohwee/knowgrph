export const FALLBACK_DETAILS: Record<string, { area?: string; responsibility?: string; notes?: string }> = {
  uiPanelOpacity: { area: 'Global Translucency', responsibility: 'Main Panel opacity' },
  uiToolbarOpacity: { area: 'Global Translucency', responsibility: 'Toolbar opacity' },
  canvasSnapEnabled: { area: 'Canvas Grid', responsibility: 'Snap-to-grid enabled (affects dragging, resizing, nudging)' },
  canvasSnapGridSize: { area: 'Canvas Grid', responsibility: 'Snap grid size (world units)', notes: 'Alt disables snapping while dragging. Arrow nudges follow the grid when enabled.' },
  canvasGridVisible: { area: 'Canvas Grid', responsibility: 'Show/hide the infinite canvas grid background' },
  canvasGridVariant: { area: 'Canvas Grid', responsibility: 'Grid background variant (dots or lines)' },
  canvasGridMajorEvery: { area: 'Canvas Grid', responsibility: 'Every N minor steps, draw a major grid' },
  canvasGridDotRadiusPx: { area: 'Canvas Grid', responsibility: 'Dot radius (px) when variant=dots' },
  historyDebounceMs: { area: 'Editor Behavior & Timing', responsibility: 'Debounce history' },
  codeHighlightDurationMs: { area: 'Editor Behavior & Timing', responsibility: 'Code highlight duration' },
  codeSelectThrottleMs: { area: 'Editor Behavior & Timing', responsibility: 'Code→Canvas selection throttle' },
  codeHighlightUntilClick: { area: 'Editor Behavior & Timing', responsibility: 'Highlight until click' },
  uiIconScale: {
    area: 'UI Density: Icons',
    responsibility: 'Global icon scale (toolbar, panels, bottom panel)',
    notes: 'Options: compact (smaller icons, denser UI) or default (larger icons, more spacious). Applied via getIconSizeClass across HeaderActions, Toolbar, SearchPanel, History panels, Launch Spotlight status, Help/Workflow headers, Graph Fields icon legend, and bottom panel toolbars.',
  },
  uiIconFormat: {
    area: 'UI Density: Icons',
    responsibility: 'Global icon format (default vs minimal styling)',
  },
  uiIconStrokeWidth: {
    area: 'UI Density: Icons',
    responsibility: 'Global Lucide icon stroke width',
  },
  uiIconColorClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon color',
  },
  uiIconHoverBgClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon hover background',
  },
  uiIconButtonPaddingClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon button padding',
  },
  uiIconPillClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon legend pills (scope, origin, visibility, field types)',
  },
  uiIconPillLegendTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for legend pill text size',
  },
  uiIconPillBadgeTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for badge and inline pill text size',
  },
  uiIconBadgeChipClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for small schema/property badge chips',
  },
  uiIconBadgeChipTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for badge chip text size',
  },
  uiPanelKeyValueTextSizeClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value text size',
  },
  uiPanelMicroLabelTextSizeClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel micro-label helper text size',
  },
  uiPanelTextFontClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value text font',
  },
  uiPanelKeyValueInputClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value numeric input shell',
  },
  uiPanelRowDensityDefaultClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for default panel row padding (density="default")',
  },
  uiPanelMonospaceTextClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel monospace text in Graph JSON, Parser, Schema, and Markdown editors',
  },
  uiHeaderRowHeightClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for primary header row min-height',
  },
  uiHeaderRowPaddingClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for primary header row padding',
  },
  uiSectionHeaderRowHeightClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for section header row min-height',
  },
  uiSectionHeaderRowPaddingClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for section header row padding',
  },
  uiIconAnimationEnabled: {
    area: 'UI Density: Icons',
    responsibility: 'Enable toolbar launch/3D icon animation',
  },
  pdfImportIncludeImages: {
    area: 'Import: PDF',
    responsibility: 'Include extracted PDF images in Markdown output',
  },
  pdfImportEmbedImages: {
    area: 'Import: PDF',
    responsibility: 'Embed eligible images as data: URIs (bounded)',
  },
  'schema.layout.forces.physics2dChargeScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale auto-tuned D3 many-body repulsion (when schema.layout.forces.charge is unset)',
  },
  'schema.layout.forces.physics2dCollideStrengthScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale auto-tuned node-node collision strength',
  },
  'schema.layout.forces.physics2dBboxStrengthScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale bbox/group-bbox collision strength (nodes, groups, rich-media boxes)',
  },
  'schema.layout.forces.physics2dVelocityDecayBias': {
    area: 'Graph Physics 2D',
    responsibility: 'Bias velocityDecay (damping) to reduce sudden motion',
  },
  'schema.layout.forces.physics2dMaxSpeedScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale per-tick max speed clamp (limits drastic jumps)',
  },
  'schema.layout.forces.physics2dStrictOverlapScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale strict overlap correction (post-layout relax for nodes/groups)',
  },
  'schema.layout.forces.physics2dLabelNudgeScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale group label-label nudge relaxation',
  },
  'schema.layout.forces.physics2dDragChargeScale': {
    area: 'Graph Physics 2D',
    responsibility: 'Scale drag-time charge softening while dragging',
  },
  'schema.layout.forces.physics2dDragDistanceMaxPx': {
    area: 'Graph Physics 2D',
    responsibility: 'Cap drag-time charge distanceMax (localizes repulsion during dragging)',
  },
  pdfImportMaxExtractedImagesPerPage: {
    area: 'Import: PDF',
    responsibility: 'Max images extracted per page (0 disables extraction)',
  },
  pdfImportMaxEmbeddedImagesPerPage: {
    area: 'Import: PDF',
    responsibility: 'Max images embedded/linked per page in Markdown',
  },
  pdfImportMaxEmbeddedTotalBytes: {
    area: 'Import: PDF',
    responsibility: 'Max total embedded image bytes per conversion',
  },
  pdfImportMaxEmbeddedAssetBytes: {
    area: 'Import: PDF',
    responsibility: 'Max bytes per embedded image asset',
  },
  pdfImportProvider: {
    area: 'Import: PDF',
    responsibility: 'PDF→Markdown provider (native local vs Docling remote)',
  },
  pdfImportDoclingEndpoint: {
    area: 'Import: PDF',
    responsibility: 'Docling HTTP endpoint (used when provider=docling-remote)',
  },
  pdfImportProviderFallbackToNative: {
    area: 'Import: PDF',
    responsibility: 'Fallback to native conversion when Docling fails',
  },
  pdfImportOcrEnabled: {
    area: 'Import: PDF',
    responsibility: 'Enable OCR enhancement for sparse text pages',
  },
  pdfImportOcrMode: {
    area: 'Import: PDF',
    responsibility: 'OCR mode (fallback vs always)',
  },
  'three.voxel.districts.enabled': {
    area: 'Voxel Mode',
    responsibility: 'Enable cluster district slabs in voxel mode',
  },
  'three.voxel.districts.paddingCells': {
    area: 'Voxel Mode',
    responsibility: 'District padding in grid cells (world quantized)',
  },
  'three.voxel.districts.opacity': {
    area: 'Voxel Mode',
    responsibility: 'District slab opacity',
  },
  'three.voxel.bridges.tubeRadius': {
    area: 'Voxel Mode',
    responsibility: 'Bridge tube radius (TubeGeometry)',
  },
  'three.voxel.bridges.opacity': {
    area: 'Voxel Mode',
    responsibility: 'Bridge tube opacity baseline',
  },
  'three.voxel.bridges.pulseStrength': {
    area: 'Voxel Mode',
    responsibility: 'Bridge tube pulse strength (opacity + emissive)',
  },
  'three.voxel.bridges.particles.enabled': {
    area: 'Voxel Mode',
    responsibility: 'Enable tube flow particles (instanced)',
  },
  'three.voxel.bridges.particles.density': {
    area: 'Voxel Mode',
    responsibility: 'Scale particles per bridge (bounded)',
  },
  'three.voxel.bridges.particles.speed': {
    area: 'Voxel Mode',
    responsibility: 'Flow particle speed along bridge curves',
  },
  'three.layout.voxelAnimationEnabled': {
    area: 'Voxel Mode',
    responsibility: 'Master on/off switch for all voxel animations',
  },
  themeMode: {
    area: 'UI Appearance',
    responsibility: 'Global color theme (Light, Dark, or System)',
    notes: 'Controls the application color palette. Light mode follows GitHub Light Tritanopia, Dark mode follows GitHub Dark Tritanopia.',
  },
  selectionFlashDurationMs: {
    area: 'Selection Flash',
    responsibility: 'Duration of canvas-driven selection flash highlights (ms)',
    notes: 'clamps to [100,2000]',
  },
  selectionFlashOpacity: {
    area: 'Selection Flash',
    responsibility: 'Opacity of canvas-driven selection flash highlights',
    notes: 'clamps to [0,1]',
  },
  floatingPanelWidthRatio: { area: 'Floating Panel Layout', responsibility: 'Floating panel width ratio (viewport)' },
  floatingPanelHeightRatio: { area: 'Floating Panel Layout', responsibility: 'Floating panel height ratio (viewport)' },
  floatingPanelZIndex: { area: 'Floating Panel Layout', responsibility: 'Floating panel z-index' },
  enableTabSync: { area: 'Tab Sync', responsibility: 'Enable cross‑tab sync' },
  enableVirtualTables: { area: 'Multi-dimensional Table Virtualization', responsibility: 'Virtualized tables' },
  'graphDataTable.overscanMultiplier': {
    area: 'Multi-dimensional Table Virtualization',
    responsibility: 'Overscan multiplier for virtual tables',
    notes:
      'To make the table more stable with fewer re-renders while scrolling, increase this toward 1.0–2.0. To reduce DOM size for very large tables, lower this toward 0.1–0.3 and optionally reduce graphDataTable.virtualOverscanRows for a more aggressive window.',
  },
  'graphDataTable.virtualOverscanRows': {
    area: 'Multi-dimensional Table Virtualization',
    responsibility: 'Virtual overscan rows (window padding)',
    notes:
      'Acts as a hard floor for overscan rows. Lower values reduce DOM size but may cause more frequent row window updates while scrolling, especially when graphDataTable.overscanMultiplier is also low.',
  },
  'graphDataTable.minRows': {
    area: 'Multi-dimensional Table Virtualization',
    responsibility: 'Min rows before virtualizing tables',
  },
  'graphDataTable.debugLogRanges': {
    area: 'Multi-dimensional Table Virtualization',
    responsibility: 'Log virtual window ranges in dev',
  },
  schemaDeriveCacheCapacity: { area: 'Graph Performance (Schema Derive Cache)', responsibility: 'LRU capacity for schema derive lists' },
  'graphDataTable.frozenDragStepNoneLabelPx': {
    area: 'Multi-dimensional Table',
    responsibility: 'Drag distance (px) from none to label boundary',
  },
  'graphDataTable.frozenDragStepLabelIdPx': {
    area: 'Multi-dimensional Table',
    responsibility: 'Drag distance (px) from label to id boundary',
  },
  'graphDataTable.numericSampleLimit': {
    area: 'Multi-dimensional Table',
    responsibility: 'Maximum samples per field when inferring numeric behavior',
  },
  'graphDataTable.numericSampleMinCount': {
    area: 'Multi-dimensional Table',
    responsibility: 'Minimum numeric samples required for aggregate eligibility',
  },
  'graphDataTable.numericSampleMinRatio': {
    area: 'Multi-dimensional Table',
    responsibility: 'Minimum numeric ratio required for aggregate eligibility',
  },
  'spotlight.margin': { area: 'Launch Spotlight Layout', responsibility: 'Viewport margin for spotlight card clamp' },
  'spotlight.nearTopThreshold': {
    area: 'Launch Spotlight Layout',
    responsibility: 'Top threshold before anchored card flips below target',
  },
  chatEndpointUrl: { area: 'Chat', responsibility: 'Chat endpoint URL (OpenAI-compatible)' },
  chatModel: { area: 'Chat', responsibility: 'Chat model name (OpenAI-compatible)' },
  chatTemperature: { area: 'Chat', responsibility: 'Chat completion temperature' },
  chatSystemPrompt: { area: 'Chat', responsibility: 'Optional system prompt for Chat' },
  CLICK_URL: { area: 'Config Constants', responsibility: 'Toolbar badge click URL' },
  PUBLIC_FALLBACK_JSON: { area: 'Dataset Loading', responsibility: 'Fallback dataset path' },
  KG_INPUT_PATH: { area: 'Pipeline Env', responsibility: 'Pipeline input path' },
  KG_OUTPUT_DIR: { area: 'Pipeline Env', responsibility: 'Pipeline output directory' },
  'max-lines': { area: 'ESLint Guard', responsibility: 'Max lines per file' },
  canvasRenderMode: { area: 'Canvas Rendering', responsibility: 'Render mode (2d or 3d)' },
  canvas3dMode: { area: 'Canvas Rendering', responsibility: '3D renderer mode (default or voxel)' },
  viewportControlsPreset: {
    area: 'Canvas Interaction (Viewport Controls)',
    responsibility: 'Pointer/wheel gesture preset (map vs design)',
    notes: 'Used by Flow and FlowEditor renderers to decide pan drag and wheel zoom behavior.',
  },
  flowEditorSelectionOnDrag: {
    area: 'Canvas Interaction (Flow Editor)',
    responsibility: 'Enable selection box on drag in Flow Editor renderer',
    notes: 'When enabled with viewportControlsPreset=design, left-drag creates a selection box. When disabled, selection box uses Shift-drag like other modes.',
  },
  flowEditorOverlayWheelProxyEnabled: {
    area: 'Canvas Interaction (Flow Editor)',
    responsibility: 'Enable wheel zoom/pan proxy when pointer is over Flow Editor fly-out overlays',
    notes: 'When enabled, wheel gestures over Node Quick Editor overlays are forwarded to the Flow canvas unless the overlay can scroll in that direction.',
  },
  viewPinned: {
    area: 'Canvas Zoom Modes',
    responsibility: 'Pin view (disables Fit/Selection auto-zoom + zoom-to-bounds requests)',
    notes: 'When enabled, Fit to Screen and Zoom to Selection modes are disabled.',
  },
  fitToScreenMode: {
    area: 'Canvas Zoom Modes',
    responsibility: 'Auto-fit graph to viewport (Fit to Screen mode)',
    notes: 'When enabled, Pin View and Zoom to Selection modes are disabled.',
  },
  zoomToSelectionMode: {
    area: 'Canvas Zoom Modes',
    responsibility: 'Auto-zoom to current selection (Zoom to Selection mode)',
    notes: 'When enabled, Pin View and Fit to Screen modes are disabled.',
  },
  zoomDurationFitMs: {
    area: 'Canvas Zoom Actions',
    responsibility: 'Animation duration (ms) for Fit-to-View / Fit-to-Screen actions',
    notes: 'clamps to [0,2000]. Used by both D3 and Flow 2D renderers.',
  },
  zoomDurationSelectionMs: {
    area: 'Canvas Zoom Actions',
    responsibility: 'Animation duration (ms) for Zoom-to-Selection action',
    notes: 'clamps to [0,2000]. Used by both D3 and Flow 2D renderers.',
  },
  wheelZoomCtrlMetaBoostMultiplier: {
    area: 'Canvas Interaction (Wheel Zoom)',
    responsibility: 'Ctrl/Meta wheel zoom boost multiplier (trackpad pinch)',
    notes: 'clamps to [1,400]. Used by D3, Flow, and FlowEditor 2D renderers.',
  },
  flowWheelZoomSpeedMultiplier: {
    area: 'Canvas Interaction (Flow Zoom)',
    responsibility: 'Wheel zoom speed multiplier for Flow renderer',
    notes: 'clamps to [0.25,2.5]. Used by D3, Flow, and FlowEditor 2D renderers.',
  },
  flowWheelZoomIncrementMultiplier: {
    area: 'Canvas Interaction (Flow Zoom)',
    responsibility: 'Wheel zoom increment multiplier for Flow renderer',
    notes: 'clamps to [0.25,5.0]. Values > 1 make each wheel gesture zoom more per delta; values < 1 make it more precise.',
  },
  flowWheelZoomSmoothMinDurationMs: {
    area: 'Canvas Interaction (Flow Zoom)',
    responsibility: 'Min duration (ms) for Flow wheel zoom smoothing animation',
    notes: 'clamps to [10,400] and is coerced to ≤ flowWheelZoomSmoothMaxDurationMs.',
  },
  flowWheelZoomSmoothMaxDurationMs: {
    area: 'Canvas Interaction (Flow Zoom)',
    responsibility: 'Max duration (ms) for Flow wheel zoom smoothing animation',
    notes: 'clamps to [10,400] and is coerced to ≥ flowWheelZoomSmoothMinDurationMs.',
  },
  orchestratorTraversalDelayMs: {
    area: 'Orchestrator Traversal',
    responsibility: 'Delay between traversal steps in Orchestrator (ms)',
  },
  'graph.behavior.selectMode': {
    area: 'Canvas Interaction',
    responsibility: 'Node selection mode (single, multi, lasso)',
    notes:
      'Selector → pick single, multi, or lasso selection behavior → shape how canvas clicks, Multi-dimensional Table row selection, and Embed/Overlay / Dataset Inspector visualizations respond to the active selection neighborhood.',
  },
  'graph.behavior.createMode': {
    area: 'Canvas Interaction',
    responsibility: 'Edge creation mode (shift-drag, click, panel-only)',
    notes:
      'Edge creator → choose shift-drag, click-source-target, or panel-only edge creation → align edge gestures with selection-aware overlays so you can inspect distributions, hierarchies, clusters, and paths without losing predictable zoom and node-drag behavior.',
  },
  'schema.layout.groups.nestedPaddingStep': {
    area: 'Canvas Layout (2D)',
    responsibility: 'Extra padding to visually separate nested groups',
    notes: 'Higher values increase outer-group breathing room to prevent nested group borders from visually snapping together.',
  },
  'schema.layout.edges.opacity': {
    area: 'Canvas Layering (2D)',
    responsibility: 'Base edge opacity in D3 renderer',
    notes: 'clamps to [0,1]. For readability, keep this lower than node/group prominence.',
  },
  'schema.layout.edges.opacityUnderGroups': {
    area: 'Canvas Layering (2D)',
    responsibility: 'Edge opacity when groups are enabled',
    notes: 'clamps to [0,1]. Used to keep edges visually beneath group underlays.',
  },
  'three.selection.selectedNodeGlowIntensity': { area: '3D Selection', responsibility: 'Selected node emissive glow intensity' },
  'three.selection.dimmedNodeOpacity': { area: '3D Selection', responsibility: 'Dimmed unselected node opacity' },
  'three.selection.dimmedEdgeOpacity': { area: '3D Selection', responsibility: 'Dimmed non‑selected edge opacity' },
  'three.selection.selectedEdgeWidth': { area: '3D Selection', responsibility: 'Selected edge stroke width in 3D' },
  'three.graph.linkDirectionalArrowLength': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge arrow length' },
  'three.graph.linkOpacity': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge opacity' },
  'three.graph.linkCurvature': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge curvature' },
  'three.graph.linkCurveRotation': { area: '3D Edges & Arrows', responsibility: 'Default 3D curve rotation' },
  'three.graph.linkDirectionalParticles': { area: '3D Particles', responsibility: 'Default edge particle count' },
  'three.graph.linkDirectionalParticleSpeed': { area: '3D Particles', responsibility: 'Default edge particle speed' },
  'three.graph.nodeSizingFormula': { area: '3D Formulas', responsibility: 'Node sizing formula (schema or importance)' },
  'three.graph.edgeWidthFormula': { area: '3D Formulas', responsibility: 'Edge width formula (schema or weight)' },
  'three.graph.layerOpacityByLayer.1': { area: '3D Layers', responsibility: 'Layer 1 base opacity' },
  'three.graph.layerOpacityByLayer.2': { area: '3D Layers', responsibility: 'Layer 2 base opacity' },
  'three.graph.layerOpacityByLayer.3': { area: '3D Layers', responsibility: 'Layer 3 base opacity' },
  'three.graph.nodeMotionIntensity': { area: '3D Motion', responsibility: 'Idle node motion intensity' },
  'three.graph.minimapOpacity': { area: '3D Minimap', responsibility: '3D minimap background opacity' },
  'three.graph.starfieldEnabled': { area: '3D Background', responsibility: 'Enable 3D starfield particle background' },
  'three.graph.starfieldCount': { area: '3D Background', responsibility: 'Starfield particle count (0 disables)' },
  'three.graph.starfieldRadius': { area: '3D Background', responsibility: 'Starfield radius around camera' },
  'three.graph.starfieldOpacity': { area: '3D Background', responsibility: 'Starfield particle brightness/opacity' },
  'three.graph.starfieldColor': { area: '3D Background', responsibility: 'Starfield particle tint color' },
  'three.layout.sphereRadius': { area: '3D Layout & Physics', responsibility: 'Base sphere radius for node layout' },
  'three.layout.seed': { area: '3D Layout & Physics', responsibility: 'Random seed for 3D layout' },
  'three.layout.minSpacing': { area: '3D Layout & Physics', responsibility: 'Minimum spacing between nodes' },
  'three.preset.presentation3d': { area: '3D Presets', responsibility: 'Apply low-motion presentation 3D preset' },
  'three.camera.backgroundColor': { area: 'Canvas Rendering', responsibility: '3D canvas background color' },
  'three.graph.polygons.elevationOffset': {
    area: '3D Group Surfaces',
    responsibility: 'Vertical offset for 3D cluster surfaces (graph layers) relative to nodes',
  },
  'three.graph.polygons.opacityMultiplier': {
    area: '3D Group Surfaces',
    responsibility: 'Global multiplier for 3D cluster surface (graph layers) fill opacity',
  },
}
