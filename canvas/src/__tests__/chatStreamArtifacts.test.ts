import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import {
  persistChatStreamArtifacts,
  resolveChatStreamArtifactBundle,
} from '@/features/chat/chatStreamArtifacts'

const MIROMIND_SHARE_URL = ['https://', 'dr.miromind.ai', '/share/', 'c753877f-7480-4e76-bf75-89fe18358943'].join('')
const MIROMIND_REPORT_SHARE_URL = ['https://', 'dr.miromind.ai', '/report/share/', 'aNHNpO7MwdMtsxKg'].join('')

export function testChatStreamArtifactBundleReusesKgcTimestampSessionFolder() {
  const bundle = resolveChatStreamArtifactBundle({
    workspacePath: '/sandbox/chat-log/20260523T174000Z/kgc_20260523T174000Z.md',
    timestampMs: Date.UTC(2026, 4, 23, 18, 0, 0),
    defaultLocalRootPath: '/sandbox/chat-log',
  })
  if (bundle.sessionId !== '20260523T174000Z') {
    throw new Error(`expected session folder timestamp derived from KGC path, got ${bundle.sessionId}`)
  }
  if (bundle.folderPath !== '/sandbox/chat-log/20260523T174000Z') {
    throw new Error(`expected timestamped session folder path, got ${bundle.folderPath}`)
  }
  if (bundle.streamLogPath !== '/sandbox/chat-log/20260523T174000Z/chat-stream-log_20260523T174000Z.md') {
    throw new Error(`unexpected stream log path ${bundle.streamLogPath}`)
  }
  if (bundle.streamReportPath !== '/sandbox/chat-log/20260523T174000Z/chat-stream-report_20260523T174000Z.md') {
    throw new Error(`unexpected stream report path ${bundle.streamReportPath}`)
  }
}

export async function testPersistChatStreamArtifactsWritesStoryboardMarkdownDocs() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    await persistChatStreamArtifacts({
      workspacePath: '/sandbox/chat-log/20260523T174000Z/kgc_20260523T174000Z.md',
      timestampMs: Date.UTC(2026, 4, 23, 17, 40, 0),
      defaultLocalRootPath: '/sandbox/chat-log',
      traceId: 'trace-stream-1',
      providerSummary: 'MiroMind · Global',
      modelId: 'mirothinker-1-7-deepresearch',
      requestText: 'Summarize the stream and preserve report URLs.',
      rawAssistantText: [
        '# Stream report',
        '',
        `- Log share: ${MIROMIND_SHARE_URL}`,
        `- Report share: ${MIROMIND_REPORT_SHARE_URL}`,
      ].join('\n'),
      usageSummary: 'Usage: total 42 · reasoning 12 · searches 2',
      finishReason: 'stop',
      reasoningSteps: ['web_search: graph observability', 'fetch_url: report artifact'],
      rawSseEvents: [
        '{"choices":[{"delta":{"reasoning_steps":[{"type":"web_search","web_search":{"search_keywords":["graph observability"]}}]}}]}',
        `{"choices":[{"delta":{"content":"${MIROMIND_REPORT_SHARE_URL}"}}]}`,
      ],
      status: 'ok',
      fetchUrlContent: async url => ({
        normalizedUrl: url,
        name: url.includes('/report/share/') ? 'report-derived.md' : 'share-derived.md',
        text: [
          '---',
          'kgCanvasSurfaceMode: "2d"',
          'kgCanvasRenderMode: "2d"',
          'kgCanvas2dRenderer: "storyboard"',
          'kgDocumentSemanticMode: "document"',
          'kgFrontmatterModeEnabled: true',
          'kgMultiDimTableModeEnabled: false',
          'kgDocumentStructureBaselineLock: false',
          `kgWebpageUrl: "${url}"`,
          'kgWebpageView: "markdown"',
          '---',
          '',
          `# Imported ${url.includes('/report/share/') ? 'Report' : 'Share'}`,
          '',
        ].join('\n'),
      }),
    })

    const fs = await getWorkspaceFs()
    const entries = await fs.listEntries()
    const entryPaths = new Set(entries.map(entry => String(entry.path || '')))
    const expectedFolder = '/sandbox/chat-log/20260523T174000Z'
    const expectedLog = `${expectedFolder}/chat-stream-log_20260523T174000Z.md`
    const expectedReport = `${expectedFolder}/chat-stream-report_20260523T174000Z.md`
    const expectedReportTwo = `${expectedFolder}/chat-02-stream-report_20260523T174000Z.md`
    const expectedDereferencedShare = `${expectedFolder}/share-01-share-derived.md`
    const expectedDereferencedReport = `${expectedFolder}/report-share-02-report-derived.md`
    for (const path of [expectedFolder, expectedLog, expectedReport, expectedReportTwo, expectedDereferencedShare, expectedDereferencedReport]) {
      if (!entryPaths.has(path)) {
        throw new Error(`expected workspace stream artifact path ${path}, got ${JSON.stringify([...entryPaths])}`)
      }
    }

    const logText = await fs.readFileText(expectedLog)
    const reportText = await fs.readFileText(expectedReport)
    const reportTwoText = await fs.readFileText(expectedReportTwo)
    const dereferencedShareText = await fs.readFileText(expectedDereferencedShare)
    if (!logText || !logText.includes('kgCanvas2dRenderer: "storyboard"') || !logText.includes('edges:')) {
      throw new Error('expected stream log markdown artifact to keep storyboard frontmatter nodes and edges')
    }
    if (!logText.includes(MIROMIND_SHARE_URL)) {
      throw new Error('expected stream log to preserve observed share URL from stream content')
    }
    if (!logText.includes(expectedDereferencedReport) || !reportText?.includes(expectedDereferencedShare)) {
      throw new Error('expected stream log/report docs to reference dereferenced workspace markdown artifacts')
    }
    if (!reportText || !reportText.includes('# Chat Stream Report')) {
      throw new Error('expected primary stream report markdown doc')
    }
    if (!reportTwoText || !reportTwoText.includes('## Share URL')) {
      throw new Error('expected secondary stream report doc for additional share artifacts')
    }
    if (!dereferencedShareText || !dereferencedShareText.includes(`kgWebpageUrl: "${MIROMIND_SHARE_URL}"`)) {
      throw new Error('expected dereferenced share markdown artifact to reuse shared imported workspace content')
    }
  } finally {
    resetWorkspaceFsForTests()
    restoreDom()
    restoreWindow()
  }
}
