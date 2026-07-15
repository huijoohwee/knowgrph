class GlbExporterFileReader {
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null
  onloadend: ((event: ProgressEvent<FileReader>) => void) | null = null
  result: string | ArrayBuffer | null = null

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then(
      result => {
        this.result = result
        this.onloadend?.({} as ProgressEvent<FileReader>)
      },
      () => this.onerror?.({} as ProgressEvent<FileReader>),
    )
  }

  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then(
      buffer => {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] || 0)
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
        this.onloadend?.({} as ProgressEvent<FileReader>)
      },
      () => this.onerror?.({} as ProgressEvent<FileReader>),
    )
  }
}

/** Makes Three.js GLTFExporter deterministic in the Node unit-test runtime. */
export async function withGlbExporterFileReader<T>(run: () => Promise<T>): Promise<T> {
  const globals = globalThis as typeof globalThis & { FileReader?: typeof FileReader }
  const original = globals.FileReader
  globals.FileReader = GlbExporterFileReader as unknown as typeof FileReader
  try {
    return await run()
  } finally {
    if (original) globals.FileReader = original
    else delete globals.FileReader
  }
}
