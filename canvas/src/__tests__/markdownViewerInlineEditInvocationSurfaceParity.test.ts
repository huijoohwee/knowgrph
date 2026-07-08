import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownViewerInlineEditInvocationChipToneMatchesReadSurface() {
  const { restore } = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const { rewriteRenderedInlineMediaForEditorHtml } = await import('@/lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml')
    const {
      DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
      readInlineKeywordChipToneValue,
      resolveDataViewChipClass,
    } = await import('@/features/markdown/ui/dataViewChipStyles')
    const token = '#canvas'
    const expectedToneClass = resolveDataViewChipClass(readInlineKeywordChipToneValue(token))
    const rawToneClass = resolveDataViewChipClass(token)
    const renderedClassName = `${DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME} ${expectedToneClass} cursor-pointer no-underline hover:underline`
    const html = [
      'This is the ',
      `<a data-kg-agentic-os-invocation-chip="1" data-kg-agentic-os-invocation-token="${token}" class="${renderedClassName}" href="https://example.com">#canvas</a>`,
      ' surface.',
    ].join('')
    const root = document.createElement('section')
    root.innerHTML = rewriteRenderedInlineMediaForEditorHtml(html)
    const editToken = root.querySelector('[data-kg-inline-invocation-edit-token="1"][data-kg-inline-invocation-markdown="#canvas"]') as HTMLElement | null
    if (!editToken) throw new Error(`expected #canvas invocation edit token, html=${root.innerHTML}`)
    const expectedClasses = expectedToneClass.split(/\s+/).filter(Boolean)
    for (const expectedClass of expectedClasses) {
      if (!editToken.classList.contains(expectedClass)) {
        throw new Error(`expected edit token to preserve read-surface tone ${expectedClass}, class=${editToken.className}`)
      }
    }
    for (const rawOnlyClass of rawToneClass.split(/\s+/).filter(cls => cls && !expectedClasses.includes(cls))) {
      if (editToken.classList.contains(rawOnlyClass)) {
        throw new Error(`expected edit token not to switch to raw sigil tone ${rawOnlyClass}, class=${editToken.className}`)
      }
    }
  } finally {
    restore()
  }
}
