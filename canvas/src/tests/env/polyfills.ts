const patchedWindows = new WeakSet<object>()

export const ensureTestEnvPolyfills = () => {
  try {
    const anyGlobal = globalThis as unknown as {
      window?: {
        HTMLIFrameElement?: unknown
        requestAnimationFrame?: unknown
        cancelAnimationFrame?: unknown
        HTMLCanvasElement?: { prototype?: { getContext?: unknown } }
      }
      HTMLIFrameElement?: unknown
    }
    const w = anyGlobal.window
    if (!w || typeof w !== 'object') return
    if (patchedWindows.has(w as unknown as object)) return

    const ctor = typeof anyGlobal.HTMLIFrameElement === 'function' ? anyGlobal.HTMLIFrameElement : (class {})
    if (typeof w.HTMLIFrameElement !== 'function') w.HTMLIFrameElement = ctor

    if (typeof w.requestAnimationFrame !== 'function') {
      w.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        const id = setTimeout(() => {
          cb(Date.now())
        }, 16) as unknown as number
        return id
      }) as unknown
    }

    if (typeof w.cancelAnimationFrame !== 'function') {
      w.cancelAnimationFrame = ((id: number) => {
        try {
          clearTimeout(id as unknown as NodeJS.Timeout)
        } catch {
          void 0
        }
      }) as unknown
    }

    const canvasProto = w.HTMLCanvasElement && w.HTMLCanvasElement.prototype
    if (canvasProto) {
      canvasProto.getContext = (() => {
        const noop = () => void 0
        return {
          canvas: null,
          clearRect: noop,
          fillRect: noop,
          strokeRect: noop,
          beginPath: noop,
          closePath: noop,
          moveTo: noop,
          lineTo: noop,
          rect: noop,
          arc: noop,
          clip: noop,
          stroke: noop,
          fill: noop,
          fillText: noop,
          measureText: (text: string) => ({ width: String(text || '').length * 6 }),
          save: noop,
          restore: noop,
          translate: noop,
          scale: noop,
          setTransform: noop,
          resetTransform: noop,
          createLinearGradient: () => ({ addColorStop: noop }),
          createRadialGradient: () => ({ addColorStop: noop }),
          createPattern: () => null,
          drawImage: noop,
          getImageData: () => ({ data: new Uint8ClampedArray(0) }),
          putImageData: noop,
          globalAlpha: 1,
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          font: '12px sans-serif',
          textBaseline: 'alphabetic',
          textAlign: 'start',
        } as unknown
      }) as unknown
    }

    patchedWindows.add(w as unknown as object)
  } catch {
    void 0
  }
}

