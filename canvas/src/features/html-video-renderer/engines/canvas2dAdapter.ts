import type { RenderEngine, RenderSpec } from '../htmlVideoRendererSsot'
import { HTML_VIDEO_ENGINE_IDS } from '../htmlVideoRendererSsot'

const CANVAS_2D_MP4_CODEC_CANDIDATES = ['avc', 'vp9', 'vp8'] as const

const assertBrowserCanvasRuntime = () => {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('canvas-2d MP4 rendering requires a browser runtime')
  }
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('canvas-2d MP4 rendering requires browser WebCodecs VideoEncoder support')
  }
}

const escapeJsonForScript = (value: unknown): string => JSON.stringify(value ?? {}).replace(/</g, '\\u003c')

const buildFrameHtml = (spec: Readonly<RenderSpec>, timeMs: number): string => {
  const seconds = timeMs / 1000
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
html, body {
  width: ${spec.width}px;
  height: ${spec.height}px;
  margin: 0;
  overflow: hidden;
  background: transparent;
}
</style>
</head>
<body>
<main data-kg-render-time-ms="${String(timeMs)}" data-kg-render-time-s="${String(seconds)}">
<style>
main {
  width: ${spec.width}px;
  height: ${spec.height}px;
  margin: 0;
  overflow: hidden;
  box-sizing: border-box;
  --kg-render-time-ms: ${timeMs};
  --kg-render-time-s: ${seconds};
}
${spec.css ?? ''}
</style>
<script type="application/json" id="knowgrph-html-video-data">${escapeJsonForScript(spec.data ?? {})}</script>
${spec.html}
</main>
</body>
</html>`
}

const createFrameRenderDocument = (spec: Readonly<RenderSpec>, timeMs: number): HTMLIFrameElement => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-label', 'HTML video frame raster host')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = `${spec.width}px`
  iframe.style.height = `${spec.height}px`
  iframe.style.border = '0'
  iframe.style.overflow = 'hidden'
  document.body.appendChild(iframe)

  const frameDocument = iframe.contentDocument
  if (!frameDocument) {
    iframe.remove()
    throw new Error('canvas-2d MP4 renderer could not create an isolated frame document')
  }
  frameDocument.open()
  frameDocument.write(buildFrameHtml(spec, timeMs))
  frameDocument.close()
  return iframe
}

const drawFrame = async (
  context: CanvasRenderingContext2D,
  spec: Readonly<RenderSpec>,
  timeMs: number,
  html2canvas: (element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>,
): Promise<void> => {
  const iframe = createFrameRenderDocument(spec, timeMs)
  try {
    const frameDocument = iframe.contentDocument
    const renderRoot = frameDocument?.querySelector('main')
    if (!(renderRoot instanceof HTMLElement)) {
      throw new Error('canvas-2d MP4 renderer could not find an isolated frame root')
    }
    const renderedCanvas = await html2canvas(renderRoot, {
      width: spec.width,
      height: spec.height,
      windowWidth: spec.width,
      windowHeight: spec.height,
      scale: 1,
      backgroundColor: null,
      logging: false,
      useCORS: true,
    })
    context.clearRect(0, 0, spec.width, spec.height)
    context.drawImage(renderedCanvas, 0, 0, spec.width, spec.height)
  } finally {
    iframe.remove()
  }
}

export const canvas2dAdapter: RenderEngine = {
  engineId: HTML_VIDEO_ENGINE_IDS.canvas2d,
  async render(spec) {
    assertBrowserCanvasRuntime()
    const {
      BufferTarget,
      CanvasSource,
      Mp4OutputFormat,
      Output,
      QUALITY_HIGH,
      getFirstEncodableVideoCodec,
    } = await import('mediabunny')
    const { default: html2canvas } = await import('html2canvas')
    const canvas = document.createElement('canvas')
    canvas.width = spec.width
    canvas.height = spec.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('canvas-2d MP4 rendering requires a 2D canvas context')

    const target = new BufferTarget()
    const output = new Output({
      format: new Mp4OutputFormat(),
      target,
    })
    const codec = await getFirstEncodableVideoCodec([...CANVAS_2D_MP4_CODEC_CANDIDATES], {
      width: spec.width,
      height: spec.height,
      bitrate: QUALITY_HIGH,
    })
    if (!codec) throw new Error('canvas-2d MP4 rendering requires an encodable browser video codec')

    const videoSource = new CanvasSource(canvas, {
      codec,
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 1,
    })
    output.addVideoTrack(videoSource)

    await output.start()
    const frameCount = Math.max(1, Math.ceil((spec.durationMs / 1000) * spec.fps))
    const frameDurationSeconds = 1 / spec.fps
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const timestampSeconds = frameIndex * frameDurationSeconds
      const timeMs = Math.min(spec.durationMs, timestampSeconds * 1000)
      await drawFrame(context, spec, timeMs, html2canvas)
      await videoSource.add(timestampSeconds, frameDurationSeconds)
    }
    await output.finalize()

    if (!target.buffer) throw new Error('canvas-2d MP4 renderer finalized without output buffer')
    return {
      blob: new Blob([target.buffer], { type: 'video/mp4' }),
      engineId: HTML_VIDEO_ENGINE_IDS.canvas2d,
      durationMs: spec.durationMs,
      fps: spec.fps,
      width: spec.width,
      height: spec.height,
      renderLog: [
        `frames=${frameCount}`,
        'rasterizer=html2canvas',
        'muxer=mediabunny',
        `codec=${codec}`,
      ],
    }
  },
}
