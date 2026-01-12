import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  buildTestMarkdownFromFile,
  buildTestMarkdownFromGithub,
  buildTestMarkdownFromAieHtml,
  buildTestMarkdownFromMlflow,
  collectMediaNodeUrls,
  assertArrayNonEmpty,
  runMarkdownToGraphWithToggle,
  renderMarkdownPreview,
  extractImgSrcsFromHtml,
} from './markdownTestUtils'

export async function testMarkdownMediaToggleEndToEnd() {
  const { restore: restoreWindow } = initWindowHarness({ navigatorOnline: true })
  const { restore: restoreDom } = initJsdomHarness()
  try {
    const markdownLocal = buildTestMarkdownFromFile()
    const markdownGithub = buildTestMarkdownFromGithub()
    const markdownAieHtml = buildTestMarkdownFromAieHtml()
    const markdownMlflow = buildTestMarkdownFromMlflow()

    const githubSourceUrl = 'https://github.com/chiphuyen/aie-book/blob/main/chapter-summaries.md'
    const mlflowSourceUrl = 'https://github.com/mlflow/mlflow/blob/master/README.md'

    const enabledLocal = runMarkdownToGraphWithToggle('file://markdown-html-img-smoke.md', markdownLocal, true)
    const enabledGithub = runMarkdownToGraphWithToggle(
      githubSourceUrl,
      markdownGithub,
      true,
    )
    const enabledMlflow = runMarkdownToGraphWithToggle(
      mlflowSourceUrl,
      markdownMlflow,
      true,
    )

    const enabledMediaUrlsLocal = collectMediaNodeUrls(enabledLocal.nodes)
    const enabledMediaUrlsGithub = collectMediaNodeUrls(enabledGithub.nodes)
    const enabledMediaUrlsMlflow = collectMediaNodeUrls(enabledMlflow.nodes)
    assertArrayNonEmpty(enabledMediaUrlsLocal, 'media node urls (local markdown)')
    assertArrayNonEmpty(enabledMediaUrlsGithub, 'media node urls (github markdown)')
    assertArrayNonEmpty(enabledMediaUrlsMlflow, 'media node urls (mlflow markdown)')

    const disabledLocal = runMarkdownToGraphWithToggle('file://markdown-html-img-smoke.md', markdownLocal, false)
    const disabledGithub = runMarkdownToGraphWithToggle(
      githubSourceUrl,
      markdownGithub,
      false,
    )
    const disabledMlflow = runMarkdownToGraphWithToggle(
      mlflowSourceUrl,
      markdownMlflow,
      false,
    )

    const disabledMediaUrlsLocal = collectMediaNodeUrls(disabledLocal.nodes)
    const disabledMediaUrlsGithub = collectMediaNodeUrls(disabledGithub.nodes)
    const disabledMediaUrlsMlflow = collectMediaNodeUrls(disabledMlflow.nodes)

    if (
      disabledMediaUrlsGithub.length === 0 &&
      disabledMediaUrlsLocal.length === 0 &&
      disabledMediaUrlsMlflow.length === 0
    ) {
      throw new Error('expected media-capable nodes when toggle is disabled')
    }

    const previewLocalHtml = renderMarkdownPreview(markdownLocal, 'markdown-html-img-smoke.md')
    const previewGithubHtml = renderMarkdownPreview(markdownGithub, githubSourceUrl)
    const previewMlflowHtml = renderMarkdownPreview(markdownMlflow, mlflowSourceUrl)
    const previewAieHtml = renderMarkdownPreview(markdownAieHtml, githubSourceUrl)

    const localImgSrcs = extractImgSrcsFromHtml(previewLocalHtml)
    const githubImgSrcs = extractImgSrcsFromHtml(previewGithubHtml)
    const mlflowImgSrcs = extractImgSrcsFromHtml(previewMlflowHtml)
    const aieHtmlImgSrcs = extractImgSrcsFromHtml(previewAieHtml)

    if (
      localImgSrcs.length === 0 &&
      githubImgSrcs.length === 0 &&
      mlflowImgSrcs.length === 0 &&
      aieHtmlImgSrcs.length === 0
    ) {
      throw new Error('expected MarkdownPreview to render at least one <img> element')
    }

    const hasAieHtmlImg = aieHtmlImgSrcs.some(src => {
      if (src.includes('assets/rlhf.png')) return true
      try {
        const decoded = decodeURIComponent(src)
        return decoded.includes('assets/rlhf.png')
      } catch {
        return false
      }
    })
    if (!hasAieHtmlImg) {
      throw new Error('expected HTML img src to resolve assets/rlhf.png')
    }
  } finally {
    restoreDom()
    restoreWindow()
  }
}
