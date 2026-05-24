import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

const DEMO_DOC_PATH = path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-timeline-animation-demo.md')

export function testTimelineAnimationDemoReusesSharedFlowFrontmatterContract() {
  const text = readFileSync(DEMO_DOC_PATH, 'utf8')
  const preset = parseCanvasWorkspaceFrontmatterPreset(text)
  if (!preset) {
    throw new Error('expected timeline animation demo to expose a parseable canvas frontmatter preset')
  }
  if (preset.canvasSurfaceMode !== '2d' || preset.canvasRenderMode !== '2d') {
    throw new Error(`expected timeline animation demo to stay on the explicit 2d surface/render preset, got ${JSON.stringify(preset)}`)
  }
  if (preset.canvas2dRenderer !== 'animation') {
    throw new Error(`expected timeline animation demo to land on the animation renderer, got ${String(preset.canvas2dRenderer)}`)
  }
  if (preset.documentSemanticMode !== 'document' || preset.frontmatterModeEnabled !== true) {
    throw new Error(`expected timeline animation demo to stay document/frontmatter driven, got ${JSON.stringify(preset)}`)
  }
  if (preset.multiDimTableModeEnabled !== false || preset.documentStructureBaselineLock !== false) {
    throw new Error(`expected timeline animation demo to keep non-animation mode toggles explicit, got ${JSON.stringify(preset)}`)
  }
  if (!text.includes('\nflow:\n')) {
    throw new Error('expected timeline animation demo to reuse the shared flow: frontmatter graph contract')
  }
  if (!text.includes('\ntimeline:\n') || !text.includes('\n  beats:\n')) {
    throw new Error('expected timeline animation demo to keep additive timing under timeline.beats.*')
  }
  if (!text.includes('id: NODE_TIMELINE') || !text.includes('"flow:sourcePortKey": beat_01_out')) {
    throw new Error('expected timeline animation demo to define canonical beat ordering through the shared flow graph')
  }
  if (!text.includes('beat_ref: beat_01') || !text.includes('beat_ref: beat_04')) {
    throw new Error('expected timeline animation demo flow nodes to carry canonical beat_ref ownership')
  }
  if (/^animation:\s*$/m.test(text)) {
    throw new Error('expected timeline animation demo to avoid a parallel animation-only frontmatter block')
  }
}

export function testTimelineAnimationDemoRetainsReferenceSwitchContractSnippet() {
  const text = readFileSync(DEMO_DOC_PATH, 'utf8')
  for (const snippet of [
    '<div class="player-config">',
    'role="switch"',
    'class="ant-switch ant-switch-checked"',
    'ant-click-animating="true"',
    'style="margin-bottom: 20px;"',
    '<div class="ant-switch-handle"></div>',
    '<span class="ant-switch-inner">Enable Runtime Auto Scroll</span>',
    '<div class="ant-click-animating-node"></div>',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected timeline animation demo to retain exact switch-contract snippet: ${snippet}`)
    }
  }
}
