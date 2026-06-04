import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { GraphHoverTooltip } from '@/components/GraphHoverTooltip'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'
import { LS_KEYS } from '@/lib/config'
import { lsSetBool } from '@/lib/persistence'

const dispatchHoverPointerEvent = (
  target: EventTarget,
  win: Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  args: { pointerId?: number; clientX?: number; clientY?: number; button?: number; buttons?: number } = {},
) => {
  type MouseEventConstructorLike = new (eventType: string, eventInitDict?: Record<string, unknown>) => Event
  const MouseEventCtor = (win as unknown as { MouseEvent: MouseEventConstructorLike }).MouseEvent
  const event = new MouseEventCtor(type, {
    bubbles: true,
    cancelable: true,
    button: args.button ?? 0,
    buttons: args.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
    clientX: args.clientX ?? 0,
    clientY: args.clientY ?? 0,
  })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: args.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { configurable: true, value: 'mouse' })
  target.dispatchEvent(event)
}

export function testGraphHoverTooltipIsNonInteractiveByDefault() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('tooltipInteractive = false')) {
    throw new Error('expected GraphHoverTooltip default to be non-interactive to avoid blocking canvas')
  }
}

export function testGraphCanvasRootDeclaresHoverTooltipInteractivity() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('<GraphHoverTooltip') || !text.includes('tooltipInteractive')) {
    throw new Error('expected GraphCanvasRoot to pass an explicit hover-panel interactivity contract to GraphHoverTooltip')
  }
}

export function testGraphHoverTooltipUsesCanonicalImageKeysOnly() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const text = readFileSync(p, 'utf8')
  const requiredSnippets = [
    "getNodeImagePreviewUrls } from '@/components/GraphCanvas/helpers'",
    'const urls = getNodeImagePreviewUrls(node)',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to use shared image preview helper snippet: ${snippet}`)
    }
  }
  const forbiddenSnippets = [
    'mdImagesJson',
    'rec.images',
    'rec.imageUrls',
    'rec.mediaUrls',
    'rec.imageUrl',
    'rec.mediaUrl',
    'rec.image_urls',
    'rec.image_url',
    'rec.thumbnail_url',
    'rec.thumbnail',
    'rec.thumbnails',
    'rec.hero_image',
    'function collectImageUrls',
  ]
  for (const snippet of forbiddenSnippets) {
    if (text.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to remove legacy image reader snippet: ${snippet}`)
    }
  }
}

export function testGraphHoverTooltipReusesSharedPanelFrameSurface() {
  const tooltipPath = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const tooltipText = readFileSync(tooltipPath, 'utf8')
  const tooltipUiPath = resolve(process.cwd(), 'src', 'features', 'panels', 'ui', 'Tooltip.tsx')
  const tooltipUiText = readFileSync(tooltipUiPath, 'utf8')
  const panelFramePath = resolve(process.cwd(), 'src', 'lib', 'ui', 'panelFrame.ts')
  const panelFrameText = readFileSync(panelFramePath, 'utf8')
  const responsiveClassesPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'responsiveElementClasses.ts')
  const responsiveClassesText = readFileSync(responsiveClassesPath, 'utf8')
  const responsiveCssPath = resolve(process.cwd(), 'src', 'styles', 'responsive-toolbar.css')
  const responsiveCssText = readFileSync(responsiveCssPath, 'utf8')
  const requiredTooltipSnippets = [
    "from '@/lib/ui/panelFrame'",
    "from '@/lib/ui/responsiveElementClasses'",
    'PANEL_FRAME_FLOATING_ROOT_STYLE',
    'PANEL_FRAME_FLOATING_BODY_STYLE',
    'UI_RESPONSIVE_TOOLTIP_EXPANDED_BODY_CLASSNAME',
    'UI_RESPONSIVE_TOOLTIP_KEY_LABEL_CLASSNAME',
    'contentStyle={hoverPanelRootStyle}',
    'contentRef={hoverPanelRootRef}',
    'contentOffset={tooltipPinned ? hoverPanelOffset : null}',
    'contentSize={tooltipPinned ? hoverPanelSize : null}',
    'data-kg-hover-panel-root',
    'data-kg-panel-frame',
  ]
  for (const snippet of requiredTooltipSnippets) {
    if (!tooltipText.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to reuse shared panel-frame surface snippet: ${snippet}`)
    }
  }
  for (const snippet of ['contentStyle?: React.CSSProperties', 'contentRef?: React.Ref<HTMLElement>', 'contentOffset?: { x: number; y: number } | null', 'contentSize?: { width: number; height?: number } | null', 'contentDataAttrs?: Record<string, string | undefined>']) {
    if (!tooltipUiText.includes(snippet)) {
      throw new Error(`expected shared Tooltip to expose neutral panel-frame extension: ${snippet}`)
    }
  }
  if (!tooltipUiText.includes('onContentMouseEnter?: () => void')) {
    throw new Error('expected shared Tooltip to expose a neutral content mouse-enter bridge hook')
  }
  for (const snippet of ['PANEL_FRAME_FLOATING_ROOT_STYLE', 'PANEL_FRAME_FLOATING_BODY_STYLE']) {
    if (!panelFrameText.includes(snippet)) {
      throw new Error(`expected panelFrame owner to expose shared floating panel style: ${snippet}`)
    }
  }
  if (tooltipText.includes('contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text} shadow-md max-w-xs text-xs`}')) {
    throw new Error('expected GraphHoverTooltip to stop owning duplicate tooltip-local panel chrome')
  }
  for (const snippet of ['max-h-[220px]', 'max-w-[80px]']) {
    if (tooltipText.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip responsive content sizing to live in shared CSS, found local snippet: ${snippet}`)
    }
  }
  for (const snippet of ['UI_RESPONSIVE_TOOLTIP_EXPANDED_BODY_CLASSNAME', 'UI_RESPONSIVE_TOOLTIP_KEY_LABEL_CLASSNAME']) {
    if (!responsiveClassesText.includes(snippet)) {
      throw new Error(`expected responsiveElementClasses to expose tooltip sizing class: ${snippet}`)
    }
  }
  for (const snippet of ['.kg-responsive-tooltip-expanded-body', '.kg-responsive-tooltip-key-label', '--kg-responsive-tooltip-expanded-body-max-height', '--kg-responsive-tooltip-key-label-max-width']) {
    if (!responsiveCssText.includes(snippet)) {
      throw new Error(`expected responsive toolbar CSS to own tooltip sizing snippet: ${snippet}`)
    }
  }
}

export function testGraphHoverTooltipReusesSharedDragResizeInteraction() {
  const tooltipPath = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const tooltipText = readFileSync(tooltipPath, 'utf8')
  const tooltipUiPath = resolve(process.cwd(), 'src', 'features', 'panels', 'ui', 'Tooltip.tsx')
  const tooltipUiText = readFileSync(tooltipUiPath, 'utf8')
  for (const snippet of [
    "from 'grph-shared/dom/pointerDrag'",
    "from '@/lib/render/mediaPanelLayout'",
    'startPointerDrag({',
    'readRichMediaPanelFrameMetrics(rootEl)',
    'computePanelFrameResizeFromDrag16x9({',
    'data-kg-hover-panel-drag-enabled',
    'data-kg-hover-panel-resize-enabled',
    'data-kg-resize-handle="se"',
  ]) {
    if (!tooltipText.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to reuse shared drag/resize snippet: ${snippet}`)
    }
  }
  for (const snippet of ['contentOffset', 'contentSize', 'contentRef']) {
    if (!tooltipUiText.includes(snippet)) {
      throw new Error(`expected shared Tooltip to carry neutral hover panel interaction prop: ${snippet}`)
    }
  }
}

export function testGraphHoverTooltipUsesSharedSemanticKey() {
  const tooltipPath = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const tooltipText = readFileSync(tooltipPath, 'utf8')
  const dataPath = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.data.ts')
  const dataText = readFileSync(dataPath, 'utf8')
  if (!tooltipText.includes('buildGraphHoverSemanticKey') || !dataText.includes('buildScopedGraphSemanticKey')) {
    throw new Error('expected GraphHoverTooltip pin/expand state to reuse the shared semantic-key helper')
  }
  for (const snippet of ['`${hoverKind}:${hoverId}`', '`${hoverInfo.kind}:${hoverInfo.id}`']) {
    if (tooltipText.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to avoid local hover key reconstruction: ${snippet}`)
    }
  }
}

export async function testGraphHoverTooltipRendersSharedPanelFrameSurface() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const graphSurface = doc.createElement('section')
    Object.defineProperty(graphSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        width: 640,
        height: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    doc.body.appendChild(graphSurface)
    const mount = doc.createElement('section')
    graphSurface.appendChild(mount)
    const root = createRoot(mount as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(GraphHoverTooltip, {
        hoverInfo: { kind: 'node', id: 'n1', clientX: 120, clientY: 90 },
        containerRef: { current: graphSurface },
        nodes: [{ id: 'n1', type: 'Entity', label: 'Alpha', properties: { description: 'Shared hover panel' } } as never],
        edges: [],
        schema: null,
        tooltipInteractive: true,
      }),
      { window: dom.window, frames: 4, tasks: 2 },
    )

    const rootEl = doc.querySelector('[data-kg-hover-panel-root="1"]') as HTMLElement | null
    if (!rootEl) throw new Error('expected GraphHoverTooltip to render the shared hover panel root')
    if (rootEl.getAttribute('data-kg-panel-frame') !== '1') {
      throw new Error('expected GraphHoverTooltip root to expose the shared panel-frame marker')
    }
    if (!String(rootEl.getAttribute('style') || '').includes('var(--kg-media-panel-radius')) {
      throw new Error('expected GraphHoverTooltip root to reuse shared panel-frame radius CSS vars')
    }
    const bodyEl = doc.querySelector('[data-kg-hover-panel="1"]') as HTMLElement | null
    if (!bodyEl) throw new Error('expected GraphHoverTooltip to render the shared hover panel body')
    if (!String(bodyEl.getAttribute('style') || '').includes('var(--kg-media-panel-padding')) {
      throw new Error('expected GraphHoverTooltip body to reuse shared panel-frame padding CSS vars')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testGraphHoverTooltipPinnedPanelCanDragAndResize() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    lsSetBool(LS_KEYS.hoverTooltipPinned, true)
    const doc = dom.window.document
    const graphSurface = doc.createElement('section')
    Object.defineProperty(graphSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        width: 640,
        height: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    doc.body.appendChild(graphSurface)
    const mount = doc.createElement('section')
    graphSurface.appendChild(mount)
    const root = createRoot(mount as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(GraphHoverTooltip, {
        hoverInfo: { kind: 'node', id: 'n1', clientX: 120, clientY: 90 },
        containerRef: { current: graphSurface },
        nodes: [{ id: 'n1', type: 'Entity', label: 'Alpha', properties: { description: 'Shared hover panel' } } as never],
        edges: [],
        schema: null,
        tooltipInteractive: true,
      }),
      { window: dom.window, frames: 4, tasks: 2 },
    )

    const rootEl = doc.querySelector('[data-kg-hover-panel-root="1"]') as HTMLElement | null
    const bodyEl = doc.querySelector('[data-kg-hover-panel="1"]') as HTMLElement | null
    const resizeHandle = doc.querySelector('[data-kg-resize-handle="se"]') as HTMLElement | null
    if (!rootEl || !bodyEl || !resizeHandle) {
      throw new Error(`expected pinned hover panel to render draggable/resizable shared controls, html=${doc.body.innerHTML}`)
    }
    if (bodyEl.getAttribute('data-kg-hover-panel-pinned') !== '1') {
      throw new Error('expected pinned hover panel body to expose pinned state')
    }

    await act(async () => {
      dispatchHoverPointerEvent(bodyEl, dom.window, 'pointerdown', { pointerId: 31, clientX: 100, clientY: 100, buttons: 1 })
      dispatchHoverPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 31, clientX: 130, clientY: 145, buttons: 1 })
      dispatchHoverPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 31, clientX: 130, clientY: 145, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    const draggedTransform = String(rootEl.style.transform || '')
    if (!draggedTransform.includes('+ 30px') || !draggedTransform.includes('45px')) {
      throw new Error(`expected pinned hover panel drag to update Tooltip offset transform, got ${draggedTransform}`)
    }

    Object.defineProperty(rootEl, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 120,
        top: 90,
        right: 380,
        bottom: 250,
        width: 260,
        height: 160,
        x: 120,
        y: 90,
        toJSON: () => ({}),
      }),
    })

    await act(async () => {
      dispatchHoverPointerEvent(resizeHandle, dom.window, 'pointerdown', { pointerId: 32, clientX: 200, clientY: 180, buttons: 1 })
      dispatchHoverPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 32, clientX: 300, clientY: 180, buttons: 1 })
      dispatchHoverPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 32, clientX: 300, clientY: 180, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    const widthPx = Number.parseFloat(rootEl.style.width || '')
    const heightPx = Number.parseFloat(rootEl.style.height || '')
    if (!Number.isFinite(widthPx) || widthPx <= 260 || !Number.isFinite(heightPx) || heightPx <= 160) {
      throw new Error(`expected pinned hover panel resize to apply shared 16:9 frame size, got width=${rootEl.style.width} height=${rootEl.style.height}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    lsSetBool(LS_KEYS.hoverTooltipPinned, false)
    restoreDom()
  }
}

export async function testGraphHoverTooltipBridgesPointerGapToPanel() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const graphSurface = doc.createElement('section')
    Object.defineProperty(graphSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        width: 640,
        height: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    doc.body.appendChild(graphSurface)
    const mount = doc.createElement('section')
    graphSurface.appendChild(mount)
    const root = createRoot(mount as unknown as HTMLElement)
    const renderTooltip = async (hoverInfo: { kind: 'node'; id: string; clientX: number; clientY: number } | null) => {
      await mountReactRoot(root,
        React.createElement(GraphHoverTooltip, {
          hoverInfo,
          containerRef: { current: graphSurface },
          nodes: [{ id: 'n1', type: 'Entity', label: 'Alpha', properties: { description: 'Shared hover panel' } } as never],
          edges: [],
          schema: null,
          tooltipInteractive: true,
        }),
        { window: dom.window, frames: 4, tasks: 2 },
      )
    }

    await renderTooltip({ kind: 'node', id: 'n1', clientX: 120, clientY: 90 })
    await renderTooltip(null)

    const bridgedRoot = doc.querySelector('[data-kg-hover-panel-root="1"]') as HTMLElement | null
    if (!bridgedRoot) throw new Error('expected hover panel to remain mounted while pointer crosses the node-to-panel gap')
    if (bridgedRoot.getAttribute('data-kg-hover-panel-bridged') !== '1') {
      throw new Error('expected hover panel root to mark node-to-panel gap bridge state')
    }

    await act(async () => {
      bridgedRoot.dispatchEvent(new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        relatedTarget: graphSurface,
      }))
      await new Promise<void>(resolve => dom.window.setTimeout(resolve, 540))
    })

    const hoveredRoot = doc.querySelector('[data-kg-hover-panel-root="1"]') as HTMLElement | null
    if (!hoveredRoot) throw new Error('expected hover panel to stay mounted after pointer enters the panel during bridge grace')
    if (hoveredRoot.getAttribute('data-kg-hover-panel-hovered') !== '1') {
      throw new Error('expected hover panel root to mark panel-hovered bridge state')
    }

    await act(async () => {
      hoveredRoot.dispatchEvent(new dom.window.MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true,
        relatedTarget: graphSurface,
      }))
      await new Promise<void>(resolve => dom.window.setTimeout(resolve, 0))
    })

    if (doc.querySelector('[data-kg-hover-panel-root="1"]')) {
      throw new Error('expected hover panel to close after leaving the bridged panel')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}
