import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { handleStoryboardCardMetaWheelEvent } from '@/components/StoryboardWidgetCanvas/StoryboardCardMetaScrollRail'
import { readStoryboardCardSummaryText } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryText'
import { readStoryboardCardSize2d } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { buildGraphNodeCanonicalTextPatch, GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS } from '@/lib/cards/graphNodeCardFields'
import { computeStoryboardWidgetOverlayScreenBox } from '@/lib/storyboardWidget/overlayWorldDrag'
import type { GraphData } from '@/lib/graph/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCardTextLayoutKeepsSemanticLabelsReadable() {
  const authoredSummary = [
    'Imported  source evidence for a validation-ready storyboard card.',
    '',
    '![Evidence frame](https://example.test/source.png)',
    'Review   authored spacing before generation.',
  ].join('\n')
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
          summary: authoredSummary,
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
  assert(cards.find(card => card.id === 'source-card')?.summary === authoredSummary, 'expected Storyboard card model to preserve authored summary typography, media markup, and spacing')
  assert(cards.find(card => card.id === 'source-card')?.typeLabel === 'Runtime Proof Gate', 'expected compact PascalCase type labels to render as readable semantic words')
  assert(cards.find(card => card.id === 'frame-card')?.typeLabel === 'Storyboard Frame', 'expected storyboard frame type labels to render as readable semantic words')
  assert(JSON.stringify(cards.find(card => card.id === 'source-card')?.invocationTokens) === JSON.stringify(['/source.normalize', '#frontmatter']), 'expected Source card to display stage-owned / and # invocation chips')
  assert(JSON.stringify(cards.find(card => card.id === 'frame-card')?.invocationTokens) === JSON.stringify(['/canvas.project', '#canvas']), 'expected explicit card invocation to display node-owned / and # invocation chips')
}

export function testStoryboardCardSummaryTextStripsInlineMediaEmbeds() {
  const rawSummary = [
    'check my hand, numb... ![空武.jpg](http://localhost:5185/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg?kg_media_token=secret)',
    '<video src="https://example.test/source.mp4" title="source clip" controls></video>',
    '<audio src="https://example.test/source.mp3" controls></audio>',
    'Review source symptoms.',
  ].join('\n')
  const actual = readStoryboardCardSummaryText(rawSummary)
  assert(actual === 'check my hand, numb...\nReview source symptoms.', `expected Storyboard summary text to strip inline media embeds, got ${JSON.stringify(actual)}`)
  const formattedSummary = `  ${rawSummary}\n\n  Preserve  authored   spacing.  `
  const patch = buildGraphNodeCanonicalTextPatch({
    currentProperties: { description: 'old summary' },
    propertyKeys: GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS,
    canonicalKey: 'summary',
    nextValue: formattedSummary,
    preserveFormatting: true,
  })
  assert(patch.summary === formattedSummary, `expected WYSIWYG summary patch to preserve raw text formatting, got ${JSON.stringify(patch.summary)}`)
  assert(!('description' in patch), 'expected WYSIWYG summary patch to remove stale alias properties')
}

export function testStoryboardCardOverlayTextLayoutUsesReadableCardChrome() {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  const surface = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx'), 'utf8')
  const runtime = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas.runtime.tsx'), 'utf8')
  const inlineEditor = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/cards/CardInlineTextEditor.tsx'), 'utf8')
  const inlineEditorSupport = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/cards/CardInlineTextEditorSupport.ts'), 'utf8')
  const mediaResponsiveCss = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/markdown-media-responsive.css'), 'utf8')
  const overlayProxy = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/canvas/storyboard-widget-overlay-proxy.ts'), 'utf8')
  const overlayInteractions = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/storyboardCardOverlayInteractions2d.ts'), 'utf8')
  const metaRail = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardMetaScrollRail.tsx'), 'utf8')
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
    'min-w-0 flex-1 truncate text-[12px]',
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
    'editorClassName="h-full min-h-[3rem] overflow-auto',
    'mediaCommandMode="external"',
    'inlineChipDensity="compact"',
    'showCommandLaunchers={false}',
    'max-h-[2.625rem] overflow-auto overscroll-contain',
    '<StoryboardCardMetaScrollRail card={card} onCommitLane={onCommitLane} onCommitType={onCommitType} />',
    'card, runCard: onRun',
    'void runWorkflowNode?.(card.id)',
  ]) {
    assert(source.includes(snippet), `expected Storyboard card overlay to keep readable text layout snippet: ${snippet}`)
  }
  const metaRailIndex = source.indexOf('<StoryboardCardMetaScrollRail card={card} onCommitLane={onCommitLane} onCommitType={onCommitType} />')
  const summaryScrollIndex = source.indexOf('data-kg-storyboard-card-summary-scroll="1"')
  assert(metaRailIndex >= 0 && summaryScrollIndex >= 0 && metaRailIndex < summaryScrollIndex, 'expected Storyboard card metadata rail to render above the summary editor')
  for (const snippet of [
    'data-kg-storyboard-card-meta-row="1"',
    'data-kg-storyboard-card-meta-scroll="1"',
    'data-kg-canvas-wheel-ignore="true"',
    'data-kg-canvas-pointer-ignore="true"',
    'data-kg-media-scroll-surface="1"',
    'overflow-x-auto overflow-y-hidden overscroll-contain',
    'handleStoryboardCardMetaWheelEvent(event, event.currentTarget)',
    'rail.addEventListener(\'wheel\', handleWheel, { passive: false, capture: true })',
    '<header',
    'border-b pb-1',
    'max-w-[5.75rem] shrink-0 truncate rounded border',
    'max-w-[8.75rem] shrink-0 truncate rounded border',
    '<StoryboardCardInvocationChips tokens={card.invocationTokens} />',
  ]) {
    assert(metaRail.includes(snippet), `expected Storyboard card metadata rail to own local scroll and gesture guard snippet: ${snippet}`)
  }
  assert(!metaRail.includes('<footer'), 'expected top Storyboard card metadata rail not to use footer semantics')
  assert(!metaRail.includes('mt-auto'), 'expected top Storyboard card metadata rail not to reserve bottom alignment')
  assert(metaRail.includes('value={card.lane || \'Storyboard\'}'), 'expected Storyboard card metadata rail to own compact lane metadata')
  assert(metaRail.includes('value={card.typeLabel}'), 'expected Storyboard card metadata rail to own compact type metadata')
  assert(!source.includes('value={card.lane || \'Storyboard\'}'), 'expected Storyboard card header not to duplicate metadata rail lane metadata')
  assert(!source.includes('value={card.typeLabel}'), 'expected Storyboard card header not to duplicate metadata rail type metadata')
  assert(surface.includes('runWorkflowNode: (nodeId: string) => Promise<void> | void'), 'expected Storyboard surface to accept the shared workflow runner for fixed card Run')
  assert(surface.includes('runWorkflowNode={props.runWorkflowNode}'), 'expected Storyboard surface to pass the shared workflow runner into fixed cards')
  assert(runtime.includes('runWorkflowNode={runWorkflowNode}'), 'expected Storyboard runtime to thread fixed card Run through the shared workflow runner')
  assert(!source.includes('grid-rows-[auto_minmax(0,1fr)_auto]'), 'expected Storyboard card text column not to reserve a blank middle row that hides useful card copy')
  assert(!source.includes('translate3d(${box.left}px, ${box.top}px, 0) scale(${box.scale})'), 'expected Storyboard card projection not to scale a composited transform texture at max zoom')
  assert(!source.includes("willChange: 'transform'"), 'expected Storyboard card projection not to request transform raster compositing')
  assert(!source.includes("backfaceVisibility: 'hidden'"), 'expected Storyboard card projection not to force a transformed compositor layer')
  assert(mediaResponsiveCss.includes("[data-kg-card-inline-chip-density='compact'] .kg-inline-chip-shell-15ch") && mediaResponsiveCss.includes('line-height: inherit') && mediaResponsiveCss.includes('padding-block: 0'), 'expected compact Card inline chip density to inherit Storyboard summary text metrics')
  assert(inlineEditor.includes("inlineChipDensity = 'regular'") && inlineEditor.includes('inlineChipDensity={inlineChipDensity}'), 'expected CardInlineTextEditor to keep compact chip density explicit and opt-in')
  assert(source.includes('nextValue,\n      preserveFormatting: true,'), 'expected Storyboard summary commits to preserve raw Viewer WYSIWYG text and spacing on graph writeback')
  assert(!source.includes('nextValue: readStoryboardCardSummaryText(nextValue)'), 'expected Storyboard summary commits not to reuse read-only display projection for graph writeback')
  assert(inlineEditorSupport.includes("multiline && !/\\boverflow-auto\\b/.test(className)"), 'expected scrollable multiline card display to keep caller-owned wrapping classes')
  assert(inlineEditor.includes("displayLineClassName = multiline && !densityOwnedDisplayClassName.includes('overflow-auto')"), 'expected scrollable multiline card display to avoid density-owned truncation')
  assert(overlayProxy.includes('[data-kg-canvas-pointer-ignore="true"]'), 'expected Storyboard overlay proxy to treat pointer-ignore scroll surfaces as interactive controls')
  assert(overlayProxy.includes('[data-kg-media-scroll-surface="1"]'), 'expected Storyboard overlay proxy to treat inner scroll surfaces as interactive controls')
  assert(overlayInteractions.includes('shouldForwardWheel: event => !isWidgetInnerPanelWheelTarget(event, root)'), 'expected Storyboard overlay wheel forwarding to yield to card-owned scroll surfaces')
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
    'UI_INLINE_CHIP_SHELL_15CH_CLASSNAME',
    'UI_INLINE_CHIP_LABEL_15CH_CLASSNAME',
    'data-kg-storyboard-card-invocation-chips="1"',
    'overflow-x-auto overflow-y-hidden',
    'overscroll-contain',
    'data-kg-canvas-wheel-ignore="true"',
    'data-kg-canvas-pointer-ignore="true"',
    'data-kg-media-scroll-surface="1"',
    'className="shrink-0 list-none"',
  ]) {
    assert(source.includes(snippet), `expected Storyboard invocation chips to reuse shared chip contract: ${snippet}`)
  }
}

export function testStoryboardCardMetaWheelScrollsInsideRail() {
  const dom = new JSDOM('<!doctype html><html><body><header></header></body></html>', { url: 'http://localhost' })
  const rail = dom.window.document.querySelector('header') as HTMLElement | null
  assert(rail, 'expected metadata rail fixture')
  Object.defineProperty(rail, 'clientWidth', { configurable: true, value: 100 })
  Object.defineProperty(rail, 'scrollWidth', { configurable: true, value: 220 })
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
  handleStoryboardCardMetaWheelEvent(event, rail)
  const firstScrollLeft = Number(rail.scrollLeft)
  assert(firstScrollLeft === 48, `expected metadata wheel to scroll the rail horizontally, got ${firstScrollLeft}`)
  assert(prevented === 1 && stopped === 1 && stoppedImmediate === 1, 'expected metadata wheel to consume the event before canvas zoom or pan handlers')
  handleStoryboardCardMetaWheelEvent({ ...event, deltaY: 400 } as unknown as WheelEvent, rail)
  const clampedScrollLeft = Number(rail.scrollLeft)
  assert(clampedScrollLeft === 120, `expected metadata wheel to clamp to max horizontal scroll, got ${clampedScrollLeft}`)
}
