import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { fitFlowEditorPinnedWidgets, readFrontmatterOverlayFitProxyScale } from '@/components/FlowCanvas/fitPinnedWidgets'
import {
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN,
} from '@/components/FlowCanvas/frontmatterLayoutConfig'
import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'

export function testFlowEditorFitIncludesPinnedWidgets() {
  const nodes = [
    {
      id: 'n1',
      type: 'Test',
      label: 'n1',
      x: 0,
      y: 0,
      properties: {
        'visual:width': 120,
        'visual:height': 80,
        'visual:shape': 'rect',
      },
    },
  ]
  const fitW = 420
  const fitH = 240
  const fitOpts = { pad: 24, minScale: 0.01, maxScale: 10 }

  const base = fitAllTransform(nodes as never, fitW, fitH, fitOpts as never)
  const withPinned = fitFlowEditorPinnedWidgets({
    nodes: nodes as never,
    fitW,
    viewportH: fitH,
    viewportW: fitW,
    openWidgetNodeIds: ['n1'],
    pinnedById: { n1: true },
    worldPosById: { n1: { x: 1000, y: 0 } },
    portExtraPadScreenPx: 0,
    graphData: null,
    fitOpts: fitOpts as never,
  })

  if (!(withPinned.k < base.k - 1e-6)) {
    throw new Error(`expected pinned widgets to reduce fit scale, base=${base.k} next=${withPinned.k}`)
  }
}

export function testFlowEditorFitCentersVisiblePinnedOverlayCollective() {
  const nodes = [
    {
      id: 'n1',
      type: 'Test',
      label: 'n1',
      x: 0,
      y: 0,
      properties: {
        'visual:width': 120,
        'visual:height': 80,
        'visual:shape': 'rect',
      },
    },
    {
      id: 'n2',
      type: 'Test',
      label: 'n2',
      x: 300,
      y: 120,
      properties: {
        'visual:width': 120,
        'visual:height': 80,
        'visual:shape': 'rect',
      },
    },
  ]
  const fitW = 1920
  const fitH = 1080
  const fitOpts = { pad: 40, minScale: 0.01, maxScale: 10 }
  const worldPosById = {
    n1: { x: 1400, y: 520 },
    n2: { x: 1840, y: 760 },
  }

  const fit = fitFlowEditorPinnedWidgets({
    nodes: nodes as never,
    fitW,
    viewportH: fitH,
    viewportW: fitW,
    openWidgetNodeIds: ['n1', 'n2'],
    pinnedById: { n1: true, n2: true },
    worldPosById,
    portExtraPadScreenPx: 0,
    graphData: null,
    fitOpts: fitOpts as never,
  })

  const panelScale = computeCollectiveFollowPinnedScale({
    zoomK: fit.k,
    extent: { minK: fitOpts.minScale, maxK: fitOpts.maxScale },
    viewportW: fitW,
    viewportH: fitH,
    count: 2,
    baseWidth: WIDGET_BASE_SIZE.width,
    baseHeight: WIDGET_BASE_SIZE.height,
  })
  const scaled = computeWidgetScaledSize(panelScale)
  const centers = Object.values(worldPosById).map(pos => ({
    x: fit.x + fit.k * pos.x + scaled.width / 2,
    y: fit.y + fit.k * pos.y + scaled.height / 2,
  }))
  const centroid = centers.reduce((acc, center) => ({
    x: acc.x + center.x,
    y: acc.y + center.y,
  }), { x: 0, y: 0 })
  centroid.x /= centers.length
  centroid.y /= centers.length

  if (Math.abs(centroid.x - fitW / 2) > 4 || Math.abs(centroid.y - fitH / 2) > 4) {
    throw new Error(`expected visible pinned overlay centroid near ${fitW / 2},${fitH / 2}, got ${centroid.x},${centroid.y}`)
  }
}

export function testFlowEditorFitDerivesFrontmatterOverlayIdsWhenOpenSetIsEmpty() {
  const fit = fitFlowEditorPinnedWidgets({
    nodes: [
      {
        id: 'w-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Text',
        x: 0,
        y: 0,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
    ] as never,
    fitW: 420,
    viewportH: 240,
    viewportW: 420,
    openWidgetNodeIds: [],
    pinnedById: {},
    worldPosById: { 'w-text': { x: 1000, y: 0 } },
    portExtraPadScreenPx: 0,
    graphData: {
      type: 'application/json',
      metadata: { kind: 'frontmatter-flow' },
      nodes: [
        {
          id: 'w-text',
          type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
          label: 'Text',
          x: 0,
          y: 0,
          properties: {},
        },
      ],
      edges: [],
    } as never,
    fitOpts: { pad: 24, minScale: 0.01, maxScale: 10 } as never,
  })

  if (!(fit.k < 0.5)) {
    throw new Error(`expected frontmatter-flow fit to derive overlay ids even when the explicit open-widget set is empty, got scale=${fit.k}`)
  }
}

export function testFlowEditorFitUsesDenserFrontmatterOverlayProxy() {
  const baseArgs = {
    nodes: [
      {
        id: 'w-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Text',
        x: 0,
        y: 0,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
      {
        id: 'w-image',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Image',
        x: 200,
        y: 40,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
      {
        id: 'w-video',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Video',
        x: 420,
        y: 80,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
    ] as never,
    fitW: 900,
    viewportH: 540,
    viewportW: 900,
    openWidgetNodeIds: ['w-text', 'w-image', 'w-video'],
    pinnedById: { 'w-text': true, 'w-image': true, 'w-video': true },
    worldPosById: {
      'w-text': { x: 1200, y: 260 },
      'w-image': { x: 1640, y: 520 },
      'w-video': { x: 2080, y: 780 },
    },
    portExtraPadScreenPx: 0,
    fitOpts: { pad: 40, minScale: 0.01, maxScale: 10 } as never,
  }
  const generic = fitFlowEditorPinnedWidgets({
    ...baseArgs,
    graphData: null,
  })
  const frontmatter = fitFlowEditorPinnedWidgets({
    ...baseArgs,
    graphData: {
      type: 'application/json',
      context: 'frontmatter-flow',
      metadata: { kind: 'frontmatter-flow' },
      nodes: [
        {
          id: 'w-text',
          type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
          label: 'Text',
          x: 0,
          y: 0,
          properties: {},
        },
        {
          id: 'w-image',
          type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
          label: 'Image',
          x: 0,
          y: 0,
          properties: {},
        },
        {
          id: 'w-video',
          type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
          label: 'Video',
          x: 0,
          y: 0,
          properties: {},
        },
      ],
      edges: [],
    } as never,
  })

  if (!(frontmatter.k > generic.k + 1e-6)) {
    throw new Error(`expected frontmatter overlay fit to use a denser proxy and retain a larger scale, generic=${generic.k} frontmatter=${frontmatter.k}`)
  }
}

export function testFrontmatterOverlayFitAvoidsTinyGraphFitBootstrapWhenPinnedNodesSpanHugeScene() {
  const baseArgs = {
    nodes: [
      {
        id: 'w-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Text',
        x: 0,
        y: 0,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
      {
        id: 'w-image',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Image',
        x: 18000,
        y: 8200,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
    ] as never,
    fitW: 1280,
    viewportH: 720,
    viewportW: 1280,
    openWidgetNodeIds: [],
    pinnedById: { 'w-text': true, 'w-image': true },
    worldPosById: {
      'w-text': { x: 0, y: 0 },
      'w-image': { x: 0, y: 0 },
    },
    portExtraPadScreenPx: 0,
    fitOpts: { pad: 40, minScale: 0.01, maxScale: 10 } as never,
    graphData: {
      type: 'application/json',
      context: 'frontmatter-flow',
      metadata: { kind: 'frontmatter-flow' },
      nodes: [
        { id: 'w-text', type: FLOW_TEXT_GENERATION_NODE_TYPE_ID, label: 'Text', x: 0, y: 0, properties: {} },
        { id: 'w-image', type: FLOW_TEXT_GENERATION_NODE_TYPE_ID, label: 'Image', x: 18000, y: 8200, properties: {} },
      ],
      edges: [],
    } as never,
  }
  const graphOnly = fitAllTransform(baseArgs.nodes as never, baseArgs.fitW, baseArgs.viewportH, baseArgs.fitOpts as never)
  const frontmatter = fitFlowEditorPinnedWidgets(baseArgs)

  if (!(frontmatter.k > graphOnly.k + 1e-6)) {
    throw new Error(`expected frontmatter overlay fit to avoid tiny graph-fit bootstrap when pinned nodes span a huge authored scene, graphOnly=${graphOnly.k} frontmatter=${frontmatter.k}`)
  }
}

export function testFrontmatterOverlayFitIgnoresStaleExplicitOpenIdsOutsideCanonicalCollective() {
  const fit = fitFlowEditorPinnedWidgets({
    nodes: [
      {
        id: 'w-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Text',
        x: 0,
        y: 0,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
      {
        id: 'p-video',
        type: 'RichMediaPanel',
        label: 'Video',
        x: 240,
        y: 80,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
      {
        id: 'stale-a',
        type: 'default',
        label: 'Stale A',
        x: 12000,
        y: 3000,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
          'flow:widgetFormId': 'fm:stale-a',
        },
      },
      {
        id: 'stale-b',
        type: 'input',
        label: 'Stale B',
        x: 16000,
        y: 5600,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
          'flow:widgetFormId': 'fm:stale-b',
        },
      },
    ] as never,
    fitW: 1280,
    viewportH: 720,
    viewportW: 1280,
    openWidgetNodeIds: ['stale-a', 'stale-b'],
    pinnedById: { 'w-text': true, 'p-video': true, 'stale-a': true, 'stale-b': true },
    worldPosById: {
      'w-text': { x: 0, y: 0 },
      'p-video': { x: 0, y: 0 },
      'stale-a': { x: 12000, y: 3000 },
      'stale-b': { x: 16000, y: 5600 },
    },
    portExtraPadScreenPx: 0,
    fitOpts: { pad: 40, minScale: 0.01, maxScale: 10 } as never,
    graphData: {
      type: 'application/json',
      context: 'frontmatter-flow',
      metadata: {
        kind: 'frontmatter-flow',
        flowWidgetRegistry: [
          { formId: 'fm:w-text' },
          { formId: 'fm:p-video' },
        ],
      },
      nodes: [
        { id: 'w-text', type: FLOW_TEXT_GENERATION_NODE_TYPE_ID, label: 'Text', x: 0, y: 0, properties: { 'flow:widgetFormId': 'fm:w-text' } },
        { id: 'p-video', type: 'RichMediaPanel', label: 'Video', x: 240, y: 80, properties: { 'flow:widgetFormId': 'fm:p-video' } },
        { id: 'stale-a', type: 'default', label: 'Stale A', x: 12000, y: 3000, properties: { 'flow:widgetFormId': 'fm:stale-a' } },
        { id: 'stale-b', type: 'input', label: 'Stale B', x: 16000, y: 5600, properties: { 'flow:widgetFormId': 'fm:stale-b' } },
      ],
      edges: [],
    } as never,
  })

  if (!(fit.k > 0.2)) {
    throw new Error(`expected frontmatter overlay fit to ignore stale explicit open ids outside the canonical collective, got scale=${fit.k}`)
  }
}

export function testFrontmatterOverlayFitExcludesNonOverlaySceneNodesFromCollectiveBounds() {
  const fit = fitFlowEditorPinnedWidgets({
    nodes: [
      {
        id: 'w-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'Text',
        x: 0,
        y: 0,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
          'flow:widgetFormId': 'fm:w-text',
        },
      },
      {
        id: 'p-video',
        type: 'RichMediaPanel',
        label: 'Video',
        x: 240,
        y: 80,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
          'flow:widgetFormId': 'fm:p-video',
        },
      },
      {
        id: 'n-huge-background',
        type: 'default',
        label: 'Huge Background',
        x: 32000,
        y: 24000,
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:shape': 'rect',
        },
      },
    ] as never,
    fitW: 1280,
    viewportH: 720,
    viewportW: 1280,
    openWidgetNodeIds: [],
    pinnedById: { 'w-text': true, 'p-video': true },
    worldPosById: {},
    portExtraPadScreenPx: 0,
    fitOpts: { pad: 40, minScale: 0.01, maxScale: 10 } as never,
    graphData: {
      type: 'application/json',
      context: 'frontmatter-flow',
      metadata: {
        kind: 'frontmatter-flow',
        flowWidgetRegistry: [
          { formId: 'fm:w-text' },
          { formId: 'fm:p-video' },
        ],
      },
      nodes: [
        { id: 'w-text', type: FLOW_TEXT_GENERATION_NODE_TYPE_ID, label: 'Text', x: 0, y: 0, properties: { 'flow:widgetFormId': 'fm:w-text' } },
        { id: 'p-video', type: 'RichMediaPanel', label: 'Video', x: 240, y: 80, properties: { 'flow:widgetFormId': 'fm:p-video' } },
        { id: 'n-huge-background', type: 'default', label: 'Huge Background', x: 32000, y: 24000, properties: {} },
      ],
      edges: [],
    } as never,
  })

  if (!(fit.k > 0.2)) {
    throw new Error(`expected frontmatter overlay fit to exclude large non-overlay scene nodes from collective bounds, got scale=${fit.k}`)
  }
}

export function testFrontmatterOverlayFitProxyScaleRespondsToViewportWidth() {
  const mobile = readFrontmatterOverlayFitProxyScale(390)
  const tablet = readFrontmatterOverlayFitProxyScale(1024)
  const desktop = readFrontmatterOverlayFitProxyScale(1920)

  if (!(mobile > tablet && tablet > desktop)) {
    throw new Error(`expected mobile-first proxy scale ordering mobile>${'tablet'}>${'desktop'}, got mobile=${mobile} tablet=${tablet} desktop=${desktop}`)
  }
}

export function testFrontmatterOverlayFitProxyScaleKeepsDesktopCollectiveUsable() {
  const desktop = readFrontmatterOverlayFitProxyScale(1920)

  if (desktop < 0.18) {
    throw new Error(`expected desktop frontmatter overlay fit proxy scale to stay above tiny-scene territory on 16:9 workspaces, got ${desktop}`)
  }
}

export function testFrontmatterOverlayFitAllowsViewportBucketOverrides() {
  const desktop = readFrontmatterOverlayFitProxyScale(1920, { desktop: FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX + 1 })
  const tablet = readFrontmatterOverlayFitProxyScale(800, { laptop: 0.33 })
  const phone = readFrontmatterOverlayFitProxyScale(390, { phone: 0.77 })

  if (desktop !== FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX) {
    throw new Error(`expected desktop override to clamp to ${FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX}, got ${desktop}`)
  }
  if (tablet !== 0.33) {
    throw new Error(`expected laptop viewport bucket override to be used at 800px, got ${tablet}`)
  }
  if (phone !== 0.77) {
    throw new Error(`expected phone viewport bucket override to be used at 390px, got ${phone}`)
  }
}

export function testFrontmatterOverlayFitClampsPoisonedLowDesktopScale() {
  const desktop = readFrontmatterOverlayFitProxyScale(1920, { desktop: 0.01 })

  if (desktop !== FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN) {
    throw new Error(`expected poisoned low desktop proxy scale to clamp up to ${FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN}, got ${desktop}`)
  }
}
