import { runJsonLdTests } from './runners/runJsonLdTests'
import { runMarkdownTests } from './runners/runMarkdownTests'
import { runParserTests } from './runners/runParserTests'
import { runSchemaTests } from './runners/runSchemaTests'
import { execTest, TestResult } from './runners/testRunnerUtils'
import { initGraphDataTablePerfHarness, readGraphDataTablePerfHarness } from './perf/graphDataTableSelectionPerf'
import { TEST_CASES_PRE_PARSER } from './registry/preParserCases'
import { TEST_CASES_POST_PARSER_0 } from './registry/postParserCases0'
import { TEST_CASES_POST_PARSER_1 } from './registry/postParserCases1'
import { TEST_CASES_POST_PARSER_2 } from './registry/postParserCases2'
import { TEST_CASES_POST_PARSER_3 } from './registry/postParserCases3'
import type { TestCaseTuple } from './runner/testRunnerTypes'

const ALL_POST_PARSER: TestCaseTuple[] = [
  ...TEST_CASES_POST_PARSER_0,
  ...TEST_CASES_POST_PARSER_1,
  ...TEST_CASES_POST_PARSER_2,
  ...TEST_CASES_POST_PARSER_3,
]

const execTuple = async (results: TestResult[], tuple: TestCaseTuple) => {
  const [name, importPath, exportName] = tuple
  await execTest(results, name, async () => {
    const mod = (await import(importPath)) as Record<string, unknown>
    const fn = mod[exportName]
    if (typeof fn !== 'function') {
      throw new Error(`Missing test export: ${importPath} -> ${exportName}`)
    }
    await (fn as () => void | Promise<void>)()
  })
}

const runNodeOnlyUiTests = async (results: TestResult[]) => {
  if (!(typeof window === 'undefined' || typeof document === 'undefined')) return

  const bootstrap =
    typeof document === 'undefined' ? (await import('@/tests/lib/jsdomHarness')).initJsdomHarness() : null
  if (bootstrap) {
    const w = bootstrap.dom.window as unknown as { URL?: { createObjectURL?: unknown } }
    if (w.URL && typeof w.URL.createObjectURL !== 'function') {
      ;(w.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:kg-test'
    }
  }

  try {
    const modShowOnCanvas = await import('@/__tests__/markdownPreviewShowOnCanvas.test')
    await execTest(results, 'ui.markdown.preview.showOnCanvas', modShowOnCanvas.testMarkdownPreviewShowOnCanvasSelectsExpectedNode)
    await execTest(results, 'ui.markdown.preview.contextMenuRendersInsideRoot', modShowOnCanvas.testMarkdownPreviewContextMenuRendersInsideRoot)
    await execTest(
      results,
      'ui.markdown.preview.tokenCacheDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewTokenCacheDoesNotCrossDocumentPath,
    )
    await execTest(
      results,
      'ui.markdown.preview.viewModeSwitchDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewViewModeSwitchDoesNotCrossDocumentPath,
    )

    await import('@/__tests__/markdownSelectionScrollHighlight.test')

    const modCollapsible = await import('@/__tests__/collapsibleDefaults.test')
    await execTest(
      results,
      'ui.collapsibleDefaultsCompactAndAnchoredToLsKeys',
      modCollapsible.testCollapsibleDefaultsCompactAndAnchoredToLsKeys,
    )

    const modStandaloneRewrite = await import('@/__tests__/htmlCanvasStandaloneRewrite.test')
    await execTest(
      results,
      'ui.export.htmlCanvas.standaloneRewriteRewritesAllUrlAttrs',
      modStandaloneRewrite.testStandaloneSvgRewriteRewritesAllUrlAttrs,
    )

    const modDatasetRev = await import('@/__tests__/layoutDatasetKeyRevFallback.test')
    await execTest(results, 'layout.datasetKey.revFallbackUsesRevision', modDatasetRev.testLayoutDatasetKeyRevFallbackUsesRevision)
  } finally {
    bootstrap?.restore()
  }
}

export const runAllTests = async () => {
  const results: TestResult[] = []

  await runMarkdownTests(results)
  await runSchemaTests(results)
  await runJsonLdTests(results)

  for (const tuple of TEST_CASES_PRE_PARSER) {
    await execTuple(results, tuple)
  }

  await runParserTests(results)

  for (const tuple of ALL_POST_PARSER) {
    await execTuple(results, tuple)
    if (tuple[0] === 'graph.subgraph.crud.clusterKindDerivesStyle') {
      await runNodeOnlyUiTests(results)
    }
  }

  return results
}

declare global {
  interface Window {
    knowgrphRunTests?: typeof runAllTests
    knowgrphInitGraphDataTablePerf?: () => void
    knowgrphReadGraphDataTablePerf?: () => {
      count: number
      avgMs: number
      p95Ms: number
      maxMs: number
    }
  }
}

if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  import.meta &&
  (import.meta as ImportMeta).env &&
  (import.meta as ImportMeta).env.DEV
) {
  window.knowgrphRunTests = runAllTests
  window.knowgrphInitGraphDataTablePerf = initGraphDataTablePerfHarness
  window.knowgrphReadGraphDataTablePerf = readGraphDataTablePerfHarness
}
