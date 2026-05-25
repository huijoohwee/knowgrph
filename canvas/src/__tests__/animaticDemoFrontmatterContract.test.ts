import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

const DEMO_DOC_PATH = path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-animatic-demo.md')
const normalizeSpace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim()

export function testAnimaticDemoReusesSharedFlowFrontmatterContract() {
  const text = readFileSync(DEMO_DOC_PATH, 'utf8')
  const preset = parseCanvasWorkspaceFrontmatterPreset(text)
  if (!preset) {
    throw new Error('expected animatic demo to expose a parseable canvas frontmatter preset')
  }
  if (preset.canvasSurfaceMode !== '2d' || preset.canvasRenderMode !== '2d') {
    throw new Error(`expected animatic demo to stay on the explicit 2d surface/render preset, got ${JSON.stringify(preset)}`)
  }
  if (preset.canvas2dRenderer !== 'animatic') {
    throw new Error(`expected animatic demo to land on the animatic renderer, got ${String(preset.canvas2dRenderer)}`)
  }
  if (preset.documentSemanticMode !== 'document' || preset.frontmatterModeEnabled !== true) {
    throw new Error(`expected animatic demo to stay document/frontmatter driven, got ${JSON.stringify(preset)}`)
  }
  if (preset.multiDimTableModeEnabled !== false || preset.documentStructureBaselineLock !== false) {
    throw new Error(`expected animatic demo to keep non-animatic mode toggles explicit, got ${JSON.stringify(preset)}`)
  }
  if (!text.includes('\nflow:\n')) {
    throw new Error('expected animatic demo to reuse the shared flow: frontmatter graph contract')
  }
  if (!text.includes('\ntimeline:\n') || !text.includes('\n  beats:\n')) {
    throw new Error('expected animatic demo to keep additive timing under timeline.beats.*')
  }
  for (const snippet of ['\n  scale:\n', 'scale: 5', 'scale_split_count: 10', 'scale_width: 160', 'start_left: 20']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected animatic demo to keep native scale config snippet: ${snippet}`)
    }
  }
  if (!text.includes('id: NODE_TIMELINE') || !text.includes('"flow:sourcePortKey": beat_01_out')) {
    throw new Error('expected animatic demo to define canonical beat ordering through the shared flow graph')
  }
  if (!text.includes('beat_ref: beat_01') || !text.includes('beat_ref: beat_04')) {
    throw new Error('expected animatic demo flow nodes to carry canonical beat_ref ownership')
  }
  if (/^animatic:\s*$/m.test(text)) {
    throw new Error('expected animatic demo to avoid a parallel animatic-only frontmatter block')
  }
}

export function testAnimaticDemoRetainsReferenceSwitchContractSnippet() {
  const text = readFileSync(DEMO_DOC_PATH, 'utf8')
  const expectedSnippet = normalizeSpace(`
    <div class="player-config">
      <button
        type="button"
        role="switch"
        aria-checked="true"
        class="ant-switch ant-switch-checked"
        ant-click-animating="true"
        style="margin-bottom: 20px;"
      >
        <div class="ant-switch-handle"></div>
        <span class="ant-switch-inner">Enable Runtime Auto Scroll</span>
        <div class="ant-click-animating-node"></div>
      </button>
    </div>
  `)
  const normalizedText = normalizeSpace(text)
  if (!normalizedText.includes(expectedSnippet)) {
    throw new Error('expected animatic demo to retain the exact normalized reference switch snippet')
  }
  for (const forbiddenSnippet of ['react-timeline-editor', 'xzdarcy/react-timeline-editor', 'fixture-only demo rows']) {
    if (text.includes(forbiddenSnippet)) {
      throw new Error(`expected animatic demo to avoid vendor-copy or hardcoded-fixture wording: ${forbiddenSnippet}`)
  }
}
}
