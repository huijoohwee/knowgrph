import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { handleStoryboardCardFooterWheelEvent } from '@/components/StoryboardWidgetCanvas/StoryboardCardFooterScrollRail'
import { readStoryboardCardSummaryText } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryText'
import { readStoryboardCardSize2d } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { computeStoryboardWidgetOverlayScreenBox } from '@/lib/storyboardWidget/overlayWorldDrag'
import type { GraphData } from '@/lib/graph/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCardTextLayoutKeepsSemanticLabelsReadable() {
  const graphData: GraphData = {
    type: 'application/json',
    metadata: {
      frontmatterMeta: {
        pipeline: {
          stages: [
            { lane: 'Source', command: '/source.normalize', semantics: ['#frontmatter', '#no-hardcode'] },
          ],
        },
      },
    },
    nodes: [
      {
        id: 'source-card',
        type: 'RuntimeProofGate',
        label: 'Source evidence',
        properties: {
          lane: 'Source',
          summary: 'Imported source evidence for a validation-ready storyboard card.',
          action: 'Review and approve the source evidence before generation.',
        },
      },
      {
        id: 'frame-card',
        type: 'StoryboardFrame',
        label: 'Storyboard frame',
        properties: {
          lane: 'Storyboard',
          invocation: '/canvas.project #canvas @runtime-proof',
          summary: 'Frame-level storyboard card generated from approved source evidence.',
        },
      },
    ],
    edges: [{ id: 'source-to-frame', source: 'source-card', target: 'frame-card', label: 'produces', properties: {} }],
  }
  const board = buildStoryboardBoardModel({ graphData, graphRevision: 1 })
  const cards = board.lanes.flatMap(lane => lane.cards)
  assert(cards.find(card => card.id === 'source-card')?.typeLabel === 'Runtime Proof Gate', 'expected compact PascalCase type labels to render as readable semantic words')
  assert(cards.find(card => card.id === 'frame-card')?.typeLabel === 'Storyboard Frame', 'expected storyboard frame type labels to render as readable semantic words')
  assert(JSON.stringify(cards.find(card => card.id === 'source-card')?.invocationTokens) === JSON.stringify(['/source.normalize', '#frontmatter']), 'expected Source card to display stage-owned / and # invocation chips')
  assert(JSON.stringify(cards.find(card => card.id === 'frame-card')?.invocationTokens) === JSON.stringify(['/canvas.project', '#canvas']), 'expected explicit card invocation to display node-owned / and # invocation chips')
}

export function testStoryboardCardSummaryTextStripsInlineMediaEmbeds() {
  const actual = readStoryboardCardSummaryText([
    'check my hand, numb... ![空武.jpg](http://localhost:5185/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg?kg_media_token=secret)',
    '<video src="https://example.test/source.mp4" title="source clip" controls></video>',
    '<audio src="https://example.test/source.mp3" controls></audio>',
    'Review source symptoms.',
  ].join('\n'))
  assert(actual === 'check my hand, numb...\nReview source symptoms.', `expected Storyboard summary text to strip inline media embeds, got ${JSON.stringify(actual)}`)
}

export function testStoryboardCardOverlayTextLayoutUsesReadableCardChrome() {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  const surface = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx'), 'utf8')
  const runtime = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas.runtime.tsx'), 'utf8')
  const inlineEditor = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/cards/CardInlineTextEditor.tsx'), 'utf8')
  const overlayProxy = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/canvas/storyboard-widget-overlay-proxy.ts'), 'utf8')
  const overlayInteractions = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/storyboardCardOverlayInteractions2d.ts'), 'utf8')
  const footerRail = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardFooterScrollRail.tsx'), 'utf8')
  for (const snippet of [
    'data-kg-storyboard-card-title-row="1"',
    'data-kg-storyboard-card-pixel-snap="1"',
    'data-kg-storyboard-card-vector-zoom="1"',
    'rounded-md shadow-md',
    'snapToDevicePixels: true',
    "import { emitStoryboardWidgetInteractionFrame } from '@/lib/canvas/storyboard-widget-overlay-proxy'",
    "import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'",
    'const currentTransform = getTransform()',
    'const paintScale = currentTransform && Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1',
    'const zoomLayoutBaseBoxByCardIdRef = React.useRef<Map<string, VectorPaintedOverlayScaleProjectionBase>>(new Map())',
    'projectVectorPaintedOverlayZoomBox({',
    'transform: currentTransform',
    'paintScale',
    'applyVectorPaintedOverlayBox(el, {',
    'left: box.left',
    'top: box.top',
    'scale: box.scale',
    'emitStoryboardWidgetInteractionFrame()',
    'max-w-[8.75rem] shrink-0 truncate rounded border',
    'grid-cols-[minmax(0,1fr)_minmax(6.25rem,36%)]',
    'data-kg-storyboard-card-body-layout="brief-media"',
    'rounded border bg-[color:var(--kg-panel-bg)]/70 p-1.5',
    'data-kg-storyboard-card-brief="1"',
    'data-kg-storyboard-card-summary-scroll="1"',
    'data-kg-canvas-wheel-ignore="true"',
    'data-kg-canvas-pointer-ignore="true"',
    'data-kg-media-scroll-surface="1"',
    'onWheelCapture={event => event.stopPropagation()}',
    'displayClassName="m-0 h-full min-h-0 select-none overflow-auto',
    'whitespace-pre-wrap break-words',
    'editorClassName="h-full min-h-[3rem] resize-none overflow-auto',
    'mediaCommandMode="external"',
    'showCommandLaunchers={false}',
    'max-h-[2.625rem] overflow-auto overscroll-contain',
    '<StoryboardCardFooterScrollRail card={card} />',
    'card, runCard: onRun',
    'void runWorkflowNode?.(card.id)',
  ]) {
    assert(source.includes(snippet), `expected Storyboard card overlay to keep readable text layout snippet: ${snippet}`)
  }
  for (const snippet of [
    'data-kg-storyboard-card-meta-row="1"',
    'data-kg-storyboard-card-footer-scroll="1"',
    'data-kg-canvas-wheel-ignore="true"',
    'data-kg-canvas-pointer-ignore="true"',
    'data-kg-media-scroll-surface="1"',
    'overflow-x-auto overflow-y-hidden overscroll-contain',
    'handleStoryboardCardFooterWheelEvent(event, event.currentTarget)',
    'rail.addEventListener(\'wheel\', handleWheel, { passive: false, capture: true })',
    '<StoryboardCardInvocationChips tokens={card.invocationTokens} />',
  ]) {
    assert(footerRail.includes(snippet), `expected Storyboard card footer rail to own local scroll and gesture guard snippet: ${snippet}`)
  }
  assert(!footerRail.includes('card.typeLabel'), 'expected Storyboard card footer rail not to duplicate the header-owned type label')
  assert(surface.includes('runWorkflowNode: (nodeId: string) => Promise<void> | void'), 'expected Storyboard surface to accept the shared workflow runner for fixed card Run')
  assert(surface.includes('runWorkflowNode={props.runWorkflowNode}'), 'expected Storyboard surface to pass the shared workflow runner into fixed cards')
  assert(runtime.includes('runWorkflowNode={runWorkflowNode}'), 'expected Storyboard runtime to thread fixed card Run through the shared workflow runner')
  assert(!source.includes('grid-rows-[auto_minmax(0,1fr)_auto]'), 'expected Storyboard card text column not to reserve a blank middle row that hides useful card copy')
  assert(!source.includes('translate3d(${box.left}px, ${box.top}px, 0) scale(${box.scale})'), 'expected Storyboard card projection not to scale a composited transform texture at max zoom')
  assert(!source.includes("willChange: 'transform'"), 'expected Storyboard card projection not to request transform raster compositing')
  assert(!source.includes("backfaceVisibility: 'hidden'"), 'expected Storyboard card projection not to force a transformed compositor layer')
  assert(source.includes('readStoryboardCardSummaryText(nextValue)'), 'expected Storyboard summary commits to strip media embeds before graph writeback')
  assert(inlineEditor.includes("multiline && !/\\boverflow-auto\\b/.test(className)"), 'expected scrollable multiline card display to keep caller-owned wrapping classes')
  assert(inlineEditor.includes("displayLineClassName = multiline && !densityOwnedDisplayClassName.includes('overflow-auto')"), 'expected scrollable multiline card display to avoid density-owned truncation')
  assert(overlayProxy.includes('[data-kg-canvas-pointer-ignore="true"]'), 'expected Storyboard overlay proxy to treat pointer-ignore scroll surfaces as interactive controls')
  assert(overlayProxy.includes('[data-kg-media-scroll-surface="1"]'), 'expected Storyboard overlay proxy to treat inner scroll surfaces as interactive controls')
  assert(overlayInteractions.includes('shouldForwardWheel: event => !isWidgetInnerPanelWheelTarget(event, root)'), 'expected Storyboard overlay wheel forwarding to yield to footer-owned scroll surfaces')
}

export function testStoryboardCardOverlayProjectionSnapsToDevicePixels() {
  const box = computeStoryboardWidgetOverlayScreenBox({
    transform: { k: 2.72, x: 0.21, y: 0.39 },
    centerWorld: { x: 128, y: 96 },
    devicePixelRatio: 2,
    snapToDevicePixels: true,
    width: 101,
    height: 63,
  })
  assert(box.left === 211, `expected snapped card left to land on a device pixel, got ${box.left}`)
  assert(box.top === 176, `expected snapped card top to land on a device pixel, got ${box.top}`)
  assert(box.scale === 2.72, `expected snapping to preserve zoom scale, got ${box.scale}`)
}

export function testStoryboardCardOverlayLayoutKeepsSharedAspectRatioSizing() {
  const card = { id: 'card-1', type: 'StoryboardFrame', label: 'Frame', properties: {} }
  const wide = readStoryboardCardSize2d(card, '16:9')
  const vertical = readStoryboardCardSize2d(card, '9:16')
  assert(wide.width > wide.height, `expected 16:9 storyboard card size to stay landscape, got ${JSON.stringify(wide)}`)
  assert(vertical.height > vertical.width, `expected 9:16 storyboard card size to stay vertical, got ${JSON.stringify(vertical)}`)
}

export function testStoryboardCardInvocationChipsReuseSharedInvocationRenderer() {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardInvocationChips.tsx'), 'utf8')
  for (const snippet of [
    'DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME',
    'renderAgenticOsInvocationKeywordChip',
    'data-kg-storyboard-card-invocation-chips="1"',
    'overflow-x-auto overflow-y-hidden',
    'overscroll-contain',
    'data-kg-canvas-wheel-ignore="true"',
    'data-kg-canvas-pointer-ignore="true"',
    'data-kg-media-scroll-surface="1"',
    'className="shrink-0 list-none"',
  ]) {
    assert(source.includes(snippet), `expected Storyboard invocation footer chips to reuse shared chip contract: ${snippet}`)
  }
}

export function testStoryboardCardFooterWheelScrollsInsideRail() {
  const dom = new JSDOM('<!doctype html><html><body><footer></footer></body></html>', { url: 'http://localhost' })
  const footer = dom.window.document.querySelector('footer') as HTMLElement | null
  assert(footer, 'expected footer rail fixture')
  Object.defineProperty(footer, 'clientWidth', { configurable: true, value: 100 })
  Object.defineProperty(footer, 'scrollWidth', { configurable: true, value: 220 })
  let prevented = 0
  let stopped = 0
  let stoppedImmediate = 0
  const event = {
    deltaX: 0,
    deltaY: 48,
    preventDefault: () => { prevented += 1 },
    stopImmediatePropagation: () => { stoppedImmediate += 1 },
    stopPropagation: () => { stopped += 1 },
  } as unknown as WheelEvent
  handleStoryboardCardFooterWheelEvent(event, footer)
  const firstScrollLeft = Number(footer.scrollLeft)
  assert(firstScrollLeft === 48, `expected footer wheel to scroll the rail horizontally, got ${firstScrollLeft}`)
  assert(prevented === 1 && stopped === 1 && stoppedImmediate === 1, 'expected footer wheel to consume the event before canvas zoom or pan handlers')
  handleStoryboardCardFooterWheelEvent({ ...event, deltaY: 400 } as unknown as WheelEvent, footer)
  const clampedScrollLeft = Number(footer.scrollLeft)
  assert(clampedScrollLeft === 120, `expected footer wheel to clamp to max horizontal scroll, got ${clampedScrollLeft}`)
}
