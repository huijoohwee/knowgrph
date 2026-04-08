let monacoStylesPromise: Promise<unknown> | null = null
let mapLibreStylesPromise: Promise<unknown> | null = null

export const ensureMonacoStyles = async (): Promise<void> => {
  if (!monacoStylesPromise) {
    monacoStylesPromise = import('monaco-editor/dev/vs/style.css')
  }
  await monacoStylesPromise
}

export const ensureMapLibreStyles = async (): Promise<void> => {
  if (!mapLibreStylesPromise) {
    mapLibreStylesPromise = import('maplibre-gl/dist/maplibre-gl.css')
  }
  await mapLibreStylesPromise
}
