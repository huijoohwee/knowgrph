import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  resolveThreeRendererLifecycleKey,
  resolveThreeCanvasSurfaceLifecycle,
  shouldMountThreeRenderer,
  type ThreeRendererMountInput,
} from '@/lib/three/threeRendererLifecycle'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

type RendererTransitionPhase = ThreeRendererMountInput & Readonly<{
  name: 'physics' | 'document-transition' | 'flight'
  documentSwitchOwnsViewport: boolean
}>

const XR_RENDERER_TRANSITION: readonly RendererTransitionPhase[] = [
  {
    name: 'physics',
    mode: 'xr',
    hasRenderableScene: true,
    webglSupported: true,
    documentSwitchOwnsViewport: false,
  },
  {
    name: 'document-transition',
    mode: 'xr',
    hasRenderableScene: false,
    webglSupported: true,
    documentSwitchOwnsViewport: true,
  },
  {
    name: 'flight',
    mode: 'xr',
    hasRenderableScene: true,
    webglSupported: true,
    documentSwitchOwnsViewport: false,
  },
]

function RendererBoundary(props: { phase: RendererTransitionPhase }): React.ReactNode {
  const surface = resolveThreeCanvasSurfaceLifecycle({
    sourceFilesBootstrapReady: true,
    geospatialOverlayOwnsViewport: false,
    liveCanvasHeroVisible: false,
    canvasRenderMode: '3d',
    heavyRuntimeIntentBlocked: false,
    activeSurface: '3d',
    documentSwitchOwnsViewport: props.phase.documentSwitchOwnsViewport,
  })
  if (!surface.mounted || !shouldMountThreeRenderer(props.phase)) {
    return React.createElement('section', {
      'data-renderer-phase': props.phase.name,
      'data-renderer-status': 'unmounted',
    })
  }
  return React.createElement('canvas', {
    key: resolveThreeRendererLifecycleKey(props.phase.mode),
    'data-renderer-phase': props.phase.name,
    'data-renderer-active': surface.active ? '1' : '0',
  })
}

test('Flight Sim keeps one XR renderer through the document transition', async () => {
  const harness = initJsdomHarness('<!doctype html><html><body><main id="root"></main></body></html>')
  const container = harness.dom.window.document.getElementById('root')
  if (!container) throw new Error('missing renderer lifecycle test root')
  const root = createRoot(container)

  try {
    let renderer: Element | null = null
    for (const phase of XR_RENDERER_TRANSITION) {
      await act(async () => {
        root.render(React.createElement(RendererBoundary, { phase }))
      })
      const currentRenderer = container.querySelector('canvas')
      assert.ok(currentRenderer, `expected the XR renderer to remain mounted during ${phase.name}`)
      if (renderer) assert.strictEqual(currentRenderer, renderer)
      assert.equal(
        currentRenderer.getAttribute('data-renderer-active'),
        phase.documentSwitchOwnsViewport ? '0' : '1',
      )
      renderer = currentRenderer
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    harness.restore()
  }
})

test('Three renderer lifecycle still rejects unsupported and empty non-XR surfaces', () => {
  assert.equal(shouldMountThreeRenderer({
    mode: 'xr',
    hasRenderableScene: true,
    webglSupported: false,
  }), false)
  assert.equal(shouldMountThreeRenderer({
    mode: '3d',
    hasRenderableScene: false,
    webglSupported: true,
  }), false)
})
