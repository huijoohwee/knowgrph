import { resolveSnapshotInlineFetchUrl } from '@/features/markdown-workspace/main/exports/exportHtmlViewer'

export async function testResolveSnapshotInlineFetchUrlUsesFetchRemoteOnLocalhost() {
  const g = globalThis as unknown as { window?: unknown }
  const prevWindow = g.window
  try {
    g.window = { location: { origin: 'http://localhost:5173', hostname: 'localhost' } } as unknown
    const out = resolveSnapshotInlineFetchUrl(
      'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png&from=appmsg',
      'image',
    )
    if (!String(out).startsWith('/__fetch_remote?url=')) {
      throw new Error(`expected /__fetch_remote, got ${String(out)}`)
    }
  } finally {
    g.window = prevWindow
  }
}

