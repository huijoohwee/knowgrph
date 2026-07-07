import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { parseChatIngestUrlCommand } from '@/features/chat/chatCommandRegistry'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { buildKnowgrphVdeoxplnChatSystemPrompt, buildKnowgrphVdeoxplnRoutingPlan } from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import {
  buildFloatingPanelChatComposerDisplayText,
  deleteFloatingPanelChatComposerProjectedTokenDisplayRange,
} from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { replaceChatComposerTrigger, resolveChatComposerTrigger } from '@/features/chat/floatingPanelChat/chatComposerTrigger'
import { buildUploadedMediaInlineCommandCandidate } from '@/lib/command-menu/inlineUploadedMediaCandidates'
import type { UploadedMediaStorageResult } from '@/lib/storage/uploadedMediaStorage'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export function testFloatingPanelChatComposerTriggerRangesStayInlineAndNeutral() {
  const slash = resolveChatComposerTrigger('Review /story', 13)
  if (!slash || slash.kind !== 'slash' || slash.query !== 'story') {
    throw new Error(`expected slash trigger at the caret, got ${JSON.stringify(slash)}`)
  }
  const slashReplacement = replaceChatComposerTrigger({
    text: 'Review /story',
    trigger: slash,
    replacement: '/storybuilding ',
  })
  if (slashReplacement.text !== 'Review /storybuilding ') {
    throw new Error(`expected only the active slash token to be replaced, got ${JSON.stringify(slashReplacement)}`)
  }

  const variable = resolveChatComposerTrigger('Use @pro', 8)
  if (!variable || variable.kind !== 'variable' || variable.query !== 'pro') {
    throw new Error(`expected variable trigger at the caret, got ${JSON.stringify(variable)}`)
  }
  const variableReplacement = replaceChatComposerTrigger({ text: 'Use @pro', trigger: variable, replacement: '{{project}}' })
  if (variableReplacement.text !== 'Use {{project}}') {
    throw new Error(`expected shared variable-token insertion, got ${JSON.stringify(variableReplacement)}`)
  }
  const invocation = resolveChatComposerTrigger('Recall #memory.sea', 18)
  if (!invocation || invocation.kind !== 'keyword' || invocation.query !== 'memory.sea') {
    throw new Error(`expected runtime invocation trigger at the caret, got ${JSON.stringify(invocation)}`)
  }
}

export function testFloatingPanelChatIngestCommandUsesSharedRegistryParser() {
  const parsed = parseChatIngestUrlCommand('/ingest-url https://example.com/source.md')
  if (parsed?.url !== 'https://example.com/source.md') {
    throw new Error(`expected canonical ingest command parsing, got ${JSON.stringify(parsed)}`)
  }
  if (parseChatIngestUrlCommand('/ingest-url not-a-url') !== null) {
    throw new Error('expected invalid ingest command URL to stay rejected')
  }
}

export function testFloatingPanelChatMemoryInvocationBuildsExternalRuntimeContract() {
  const directives = parseChatInvocationDirectives('Use #memory.search with #media, #mcp, and #model for this request.')
  if (directives.map(directive => directive.id).join(',') !== 'memory.search,media,mcp,model') {
    throw new Error(`expected ordered deduplicated invocation directives, got ${JSON.stringify(directives)}`)
  }
  const invocationPrompt = buildChatInvocationSystemPrompt({
    userQuery: 'Use #memory.search with #media, #mcp, and #model for this request.',
    chatProvider: 'openai',
    chatModel: 'gpt-5-nano',
  })
  for (const expected of ['knowgrph.memory.search', 'openai / gpt-5-nano', 'explicit user_id', 'media references present', 'never claim execution']) {
    if (!invocationPrompt.includes(expected)) throw new Error(`expected invocation prompt to include ${expected}`)
  }

  const plan = buildKnowgrphVdeoxplnRoutingPlan({ intentText: '#memory.search recall scoped memory context' })
  if (plan.selectedVdeoxplnId !== 'knowgrph-memory-layer') {
    throw new Error(`expected memory invocation to select the memory-layer runtime, got ${JSON.stringify(plan)}`)
  }
  const routingPrompt = buildKnowgrphVdeoxplnChatSystemPrompt(plan)
  for (const toolName of ['knowgrph.memory.add', 'knowgrph.memory.search', 'knowgrph.memory.assemble_prompt']) {
    if (!routingPrompt.includes(toolName)) throw new Error(`expected routing prompt to expose ${toolName}`)
  }

  const uploadedCandidate = buildUploadedMediaInlineCommandCandidate({
    id: 'cloudflare-media:cover',
    name: 'Storyboard cover',
    kind: 'image',
    localUrl: '',
    linkUrl: 'https://media.example/cover.png',
    contentType: 'image/png',
    sizeBytes: 128,
    status: 'synced',
    error: null,
    storage: {
      workspaceId: 'workspace', runId: 'run', stageId: 'image', shotId: 'cover', objectKey: 'media/cover.png',
      publicPath: '/media/cover.png', publicUrl: 'https://media.example/cover.png', accessUrl: 'https://media.example/cover.png',
      contentHash: 'sha256:cover', contentType: 'image/png', provenance: {}, response: {},
    } as unknown as UploadedMediaStorageResult,
  })
  if (uploadedCandidate?.description !== 'Uploaded media from FloatingPanel Media' || uploadedCandidate.sourceKey !== 'sha256:cover') {
    throw new Error(`expected shared FloatingPanel Media candidate projection, got ${JSON.stringify(uploadedCandidate)}`)
  }
}

export async function testFloatingPanelChatComposerReusesSlashAndVariableMenus() {
  const sourceRoot = process.cwd()
  const readSource = (relativePath: string): string => readFileSync(resolve(sourceRoot, 'src', relativePath), 'utf8')
  const sharedItemBuilderSource = readSource('lib/command-menu/inlineCommandMenuItems.ts')
  for (const snippet of [
    'buildInlineCommandMenuItem',
    'buildInlineMediaCommandMenuItem',
    'buildInlineVariableBrowseMenuItem',
    'buildInlineKeywordCommandMenuItem',
    'buildInlineCommandActionMenuItem',
  ]) {
    if (!sharedItemBuilderSource.includes(snippet)) {
      throw new Error(`expected shared inline command item builder to expose ${snippet}`)
    }
  }
  const chatComposerSource = readSource('features/chat/floatingPanelChat/FloatingPanelChatComposer.tsx')
  const cardCommandMenuSource = readSource('lib/cards/CardInlineTextCommandMenus.tsx')
  const workspaceInlineMenuSource = readSource('lib/markdown-core/ui/markdownBlockContainerCore.inlineMenusOverlay.tsx')
  const storyboardCardSlotSource = readSource('components/StoryboardWidgetCanvas/StoryboardCardMediaDropSlot2d.tsx')
  for (const [label, source, snippets] of [
    ['FloatingPanel Chat', chatComposerSource, ['buildInlineCommandMenuItem', 'buildInlineMediaCommandMenuItem', 'buildInlineVariableBrowseMenuItem', 'buildInlineKeywordCommandMenuItem']],
    ['Card inline commands', cardCommandMenuSource, ['buildInlineCommandActionMenuItem', 'buildInlineMediaCommandMenuItem', 'buildInlineVariableBrowseMenuItem', 'buildInlineKeywordCommandMenuItem']],
    ['Editor workspace inline commands', workspaceInlineMenuSource, ['buildInlineCommandActionMenuItem', 'buildInlineMediaCommandMenuItem', 'buildInlineVariableBrowseMenuItem']],
    ['Storyboard 2D card media slot', storyboardCardSlotSource, ['InlineMediaCommandThumbnail', 'data-kg-storyboard-card-media-chip="1"', 'variant="inline"']],
  ] as const) {
    for (const snippet of snippets) {
      if (!source.includes(snippet)) throw new Error(`expected ${label} to reuse shared inline command/media chip owner: ${snippet}`)
    }
  }

  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  function Harness() {
    const [input, setInput] = React.useState('')
    return (
      <React.Fragment>
        <output data-kg-test-chat-raw-input="true">{input}</output>
        <FloatingPanelChatComposer
          input={input}
          setInput={setInput}
          markdownText={'---\nproject: knowgrph\ncoverUrl: https://example.com/media/cover.png\n---\n# Brief'}
          isLoading={false}
          isSubmitDisabled={false}
          uiPanelTextFontClass="text-sm"
          placeholder="Ask a question"
        />
      </React.Fragment>
    )
  }

  try {
    await mountReactRoot(root, React.createElement(Harness), { window: dom.window as unknown as Window, frames: 2 })
    const textarea = container.querySelector('[data-kg-chat-input="true"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected chat composer textarea')
    textarea.value = '/sto'
    textarea.setSelectionRange(4, 4)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)

    const slashMenu = dom.window.document.querySelector('section[aria-label="Chat slash commands"]')
    if (!slashMenu) throw new Error('expected slash trigger to mount the shared command menu')
    const storybuilding = Array.from(slashMenu.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('/storybuilding'))
    if (!storybuilding) throw new Error('expected slash menu to reuse the chat skill registry')
    storybuilding.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '/storybuilding ') {
      throw new Error(`expected slash selection to update the controlled composer, got ${JSON.stringify(textarea.value)}`)
    }
    const storybuildingChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/storybuilding"]')
    if (!storybuildingChip) throw new Error(`expected selected /storybuilding token to render through the shared chat composer chip overlay, html=${container.innerHTML}`)
    if (storybuildingChip.getAttribute('data-kg-chat-input-command-metric') !== 'preserve') {
      throw new Error(`expected slash token chip to preserve textarea caret metrics, got ${JSON.stringify(storybuildingChip.outerHTML)}`)
    }
    if (textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1') {
      throw new Error(`expected slash-chip composer textarea to expose the overlay contract, got ${JSON.stringify(textarea.outerHTML)}`)
    }

    textarea.value = '@pro'
    textarea.setSelectionRange(4, 4)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const variableMenu = dom.window.document.querySelector('section[aria-label="Chat variable commands"]')
    const project = Array.from((variableMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('project'))
    if (!project) throw new Error('expected variable menu to reuse workspace frontmatter variables')
    project.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '{{project}}') {
      throw new Error(`expected @ selection to insert the shared variable token, got ${JSON.stringify(textarea.value)}`)
    }

    textarea.value = '@cover'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mediaMenu = dom.window.document.querySelector('section[aria-label="Chat variable commands"]')
    const cover = Array.from((mediaMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('Image: coverUrl'))
    if (!cover) throw new Error('expected @ menu to reuse workspace and FloatingPanel Media candidates')
    const coverThumbnail = cover.querySelector('[data-kg-inline-command-thumbnail="image"] img')
    if (!(coverThumbnail instanceof dom.window.HTMLImageElement)) {
      throw new Error('expected FloatingPanel Chat @ media command to reuse the shared inline media thumbnail renderer')
    }
    if (cover.getAttribute('data-kg-inline-command-media-kind') !== 'image') {
      throw new Error(`expected FloatingPanel Chat @ media command row to expose the shared media-kind marker, got ${JSON.stringify(cover.getAttribute('data-kg-inline-command-media-kind'))}`)
    }
    if (coverThumbnail.getAttribute('src') !== 'https://example.com/media/cover.png') {
      throw new Error(`expected Chat @ media thumbnail to use the resolved media URL, got ${JSON.stringify(coverThumbnail.getAttribute('src'))}`)
    }
    cover.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    const rawInput = container.querySelector('[data-kg-test-chat-raw-input="true"]') as HTMLOutputElement | null
    if (!rawInput?.textContent?.includes('![Image: coverUrl](https://example.com/media/cover.png)')) {
      throw new Error(`expected @ media selection to preserve the shared media embed in raw state, got ${JSON.stringify(rawInput?.textContent || '')}`)
    }
    if (textarea.value.includes('https://example.com/media/cover.png') || textarea.value.includes('![')) {
      throw new Error(`expected visible Chat textarea to use compact media text instead of raw markdown, got ${JSON.stringify(textarea.value)}`)
    }
    if (!textarea.value.includes('Image: coverUrl')) {
      throw new Error(`expected visible Chat textarea to reserve compact chip text for stable caret layout, got ${JSON.stringify(textarea.value)}`)
    }
    const overlayChipThumbnail = container.querySelector('[data-kg-chat-input-media-chip="1"] [data-kg-inline-command-thumbnail="image"] img') as HTMLImageElement | null
    if (!overlayChipThumbnail) throw new Error(`expected Chat composer media embed to render through shared inline media chip overlay, html=${container.innerHTML}`)
    if (overlayChipThumbnail.getAttribute('src') !== 'https://example.com/media/cover.png') {
      throw new Error(`expected Chat composer overlay thumbnail to preserve media URL, got ${JSON.stringify(overlayChipThumbnail.getAttribute('src'))}`)
    }
    const mediaMetricToken = container.querySelector('[data-kg-chat-input-media-metric="preserve"]')
    if (!mediaMetricToken) throw new Error(`expected Chat composer media chip to reserve textarea display metrics, html=${container.innerHTML}`)
    if (!String(textarea.getAttribute('class') || '').includes('text-transparent')) {
      throw new Error(`expected raw media markdown to stay textarea-owned but visually projected, class=${JSON.stringify(textarea.getAttribute('class'))}`)
    }
    if (!String(textarea.getAttribute('class') || '').includes('selection:bg-transparent')) {
      throw new Error(`expected raw media markdown selection to stay visually compact around the projected chip, class=${JSON.stringify(textarea.getAttribute('class'))}`)
    }
    if (textarea.getAttribute('data-kg-chat-input-media-overlay-active') !== '1') {
      throw new Error(`expected media-chip composer textarea to expose the native selection suppression contract, got ${JSON.stringify(textarea.outerHTML)}`)
    }
    const selectionStyle = container.querySelector('style[data-kg-chat-input-overlay-selection-style="1"]')
    if (!selectionStyle?.textContent?.includes("textarea[data-kg-chat-input-overlay-active='1']::selection") || !selectionStyle.textContent.includes("textarea[data-kg-chat-input-media-overlay-active='1']::-moz-selection")) {
      throw new Error('expected Chat composer media overlay selection suppression to live with the shared composer owner')
    }
    const overlay = container.querySelector('[data-kg-chat-input-media-overlay="1"]') as HTMLElement | null
    if (!overlay) throw new Error('expected Chat composer media overlay')
    const overlayText = String(overlay.textContent || '')
    if (overlayText.includes('https://example.com/media/cover.png') || overlayText.includes('![')) {
      throw new Error(`expected Chat composer overlay to project compact media chip text instead of raw markdown, got ${JSON.stringify(overlayText)}`)
    }
    const mediaOnlyDisplayText = textarea.value
    textarea.value = `I can /storybuilding the #memory.search at ${mediaOnlyDisplayText}, that sounds great! so we can`
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mixedRawText = String(rawInput.textContent || '')
    if (!mixedRawText.includes('I can /storybuilding the #memory.search at ![Image: coverUrl](https://example.com/media/cover.png) , that sounds great! so we can')) {
      throw new Error(`expected mixed / # @ composer input to preserve raw media and command tokens, got ${JSON.stringify(mixedRawText)}`)
    }
    const mixedSlashChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/storybuilding"]')
    const mixedKeywordChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.search"]')
    const mixedMediaMetricToken = container.querySelector('[data-kg-chat-input-media-metric="inline-text"]')
    const mixedMediaChipThumbnail = container.querySelector('[data-kg-chat-input-media-render="preserve"] [data-kg-inline-command-thumbnail="image"] img') as HTMLImageElement | null
    if (!mixedSlashChip || !mixedKeywordChip || !mixedMediaMetricToken || !mixedMediaChipThumbnail) {
      throw new Error(`expected mixed / # @ composer input to render all projected chip families without mutating layout or media-chip styling, html=${container.innerHTML}`)
    }
    if (mixedMediaChipThumbnail.getAttribute('src') !== 'https://example.com/media/cover.png') {
      throw new Error(`expected mixed / # @ composer media chip to preserve its shared thumbnail renderer, got ${JSON.stringify(mixedMediaChipThumbnail.outerHTML)}`)
    }
    textarea.value = mediaOnlyDisplayText
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    textarea.value = `${textarea.value}after`
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    if (!rawInput.textContent?.includes('![Image: coverUrl](https://example.com/media/cover.png) after')) {
      throw new Error(`expected typing after compact chip to append after the raw media embed without mutating the visible input, got ${JSON.stringify(rawInput.textContent || '')}`)
    }

    textarea.value = `${textarea.value} /sto`
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mediaSlashMenu = dom.window.document.querySelector('section[aria-label="Chat slash commands"]')
    const mediaStorybuilding = Array.from((mediaSlashMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('/storybuilding'))
    if (!mediaStorybuilding) throw new Error('expected slash menu to stay active after a compact media chip')
    mediaStorybuilding.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (!rawInput.textContent?.includes('![Image: coverUrl](https://example.com/media/cover.png) after /storybuilding ')) {
      throw new Error(`expected / trigger replacement after compact chip to preserve raw media state, got ${JSON.stringify(rawInput.textContent || '')}`)
    }
    if (textarea.value.includes('https://example.com/media/cover.png') || textarea.value.includes('![')) {
      throw new Error(`expected slash replacement after compact chip to keep raw markdown hidden, got ${JSON.stringify(textarea.value)}`)
    }
    const chipSlashToken = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/storybuilding"]')
    if (!chipSlashToken) throw new Error(`expected /storybuilding after compact media to render as a shared chat composer chip, html=${container.innerHTML}`)
    if (chipSlashToken.getAttribute('data-kg-chat-input-command-metric') !== 'preserve') {
      throw new Error(`expected /storybuilding chip after compact media to preserve textarea caret metrics, got ${JSON.stringify(chipSlashToken.outerHTML)}`)
    }

    textarea.value = `${textarea.value}#memory.sea`
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const chipInvocationMenu = dom.window.document.querySelector('section[aria-label="Chat runtime invocations"]')
    const mediaMemorySearch = Array.from((chipInvocationMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('#memory.search'))
    if (!mediaMemorySearch) throw new Error('expected # menu to stay active after a compact media chip')
    mediaMemorySearch.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (!rawInput.textContent?.includes('![Image: coverUrl](https://example.com/media/cover.png) after /storybuilding #memory.search ')) {
      throw new Error(`expected # trigger replacement after compact chip to preserve raw media state, got ${JSON.stringify(rawInput.textContent || '')}`)
    }
    if (textarea.value.includes('https://example.com/media/cover.png') || textarea.value.includes('![')) {
      throw new Error(`expected # replacement after compact chip to keep raw markdown hidden, got ${JSON.stringify(textarea.value)}`)
    }
    const chipKeywordToken = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.search"]')
    if (!chipKeywordToken) throw new Error(`expected #memory.search after compact media to render as a shared chat composer chip, html=${container.innerHTML}`)
    if (chipKeywordToken.getAttribute('data-kg-chat-input-command-metric') !== 'preserve') {
      throw new Error(`expected #memory.search chip after compact media to preserve textarea caret metrics, got ${JSON.stringify(chipKeywordToken.outerHTML)}`)
    }
    const mixedMediaLabel = mediaOnlyDisplayText.trim()
    const mixedMediaLabelStart = textarea.value.indexOf(mixedMediaLabel)
    if (mixedMediaLabelStart < 0) throw new Error(`expected mixed composer display to contain media label ${JSON.stringify(mixedMediaLabel)}, got ${JSON.stringify(textarea.value)}`)
    const mixedMediaLabelEnd = mixedMediaLabelStart + mixedMediaLabel.length
    textarea.setSelectionRange(mixedMediaLabelEnd, mixedMediaLabelEnd)
    Simulate.keyDown(textarea, { key: 'Backspace' })
    await waitForFrames(dom.window as unknown as Window, 2)
    if (rawInput.textContent?.includes('https://example.com/media/cover.png') || rawInput.textContent?.includes('![')) {
      throw new Error(`expected Backspace at mixed @ media chip boundary to delete the raw media embed, got ${JSON.stringify(rawInput.textContent || '')}`)
    }
    if (textarea.value.includes(mixedMediaLabel)) {
      throw new Error(`expected Backspace at mixed @ media chip boundary to remove the visible media label, got ${JSON.stringify(textarea.value)}`)
    }
    const postDeleteSlashChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/storybuilding"]')
    const postDeleteKeywordChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.search"]')
    if (!postDeleteSlashChip || !postDeleteKeywordChip) {
      throw new Error(`expected deleting mixed @ media chip to preserve / and # chips, html=${container.innerHTML}`)
    }
    const adjacentRawMedia = 'I can ![Image: coverUrl](https://example.com/media/cover.png) after /storybuilding #memory.search '
    const adjacentDisplayMedia = buildFloatingPanelChatComposerDisplayText(adjacentRawMedia)
    const adjacentMediaLabelStart = adjacentDisplayMedia.indexOf(mixedMediaLabel)
    if (adjacentMediaLabelStart < 0) throw new Error(`expected adjacent-delete display to contain media label ${JSON.stringify(mixedMediaLabel)}, got ${JSON.stringify(adjacentDisplayMedia)}`)
    const adjacentMediaLabelEnd = adjacentMediaLabelStart + mixedMediaLabel.length
    const adjacentDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: adjacentRawMedia,
      selectionStart: adjacentMediaLabelEnd + 1,
      selectionEnd: adjacentMediaLabelEnd + 1,
      direction: 'backward',
    })
    if (!adjacentDelete || adjacentDelete.text.includes('https://example.com/media/cover.png') || adjacentDelete.text.includes('![')) {
      throw new Error(`expected Backspace after mixed @ media chip spacing to delete the raw media embed, got ${JSON.stringify(adjacentDelete)}`)
    }
    const adjacentDeleteDisplay = buildFloatingPanelChatComposerDisplayText(adjacentDelete.text)
    if (adjacentDeleteDisplay.includes(mixedMediaLabel)) {
      throw new Error(`expected Backspace after mixed @ media chip spacing to remove the visible media label, got ${JSON.stringify(adjacentDeleteDisplay)}`)
    }

    textarea.value = '#memory.sea'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const invocationMenu = dom.window.document.querySelector('section[aria-label="Chat runtime invocations"]')
    const memorySearch = Array.from((invocationMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('#memory.search'))
    if (!memorySearch) throw new Error('expected # menu to expose the memory search MCP invocation')
    memorySearch.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '#memory.search ') {
      throw new Error(`expected # selection to insert the runtime invocation token, got ${JSON.stringify(textarea.value)}`)
    }
    const memorySearchChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.search"]')
    if (!memorySearchChip) throw new Error(`expected selected #memory.search token to render through the shared chat composer chip overlay, html=${container.innerHTML}`)

    textarea.value = 'i can #memory.add , /storybuilding'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== 'i can #memory.add , /storybuilding') {
      throw new Error(`expected registry token chips to preserve raw visible text, got ${JSON.stringify(textarea.value)}`)
    }
    const memoryAddChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.add"]')
    const slashStorybuildingChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/storybuilding"]')
    if (!memoryAddChip || !slashStorybuildingChip) {
      throw new Error(`expected #memory.add and /storybuilding to render as @-like composer chips without media, html=${container.innerHTML}`)
    }
    if (memoryAddChip.getAttribute('data-kg-chat-input-command-metric') !== 'preserve' || slashStorybuildingChip.getAttribute('data-kg-chat-input-command-metric') !== 'preserve') {
      throw new Error(`expected #memory.add and /storybuilding chips to preserve textarea caret metrics, html=${container.innerHTML}`)
    }
    const slashChipEnd = textarea.value.indexOf('/storybuilding') + '/storybuilding'.length
    textarea.setSelectionRange(slashChipEnd, slashChipEnd)
    Simulate.keyDown(textarea, { key: 'Backspace' })
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value.includes('/storybuilding')) {
      throw new Error(`expected Backspace at /storybuilding chip boundary to delete the projected slash token, got ${JSON.stringify(textarea.value)}`)
    }
    if (!textarea.value.includes('#memory.add')) {
      throw new Error(`expected deleting /storybuilding to preserve the #memory.add chip text, got ${JSON.stringify(textarea.value)}`)
    }
    const keywordChipEnd = textarea.value.indexOf('#memory.add') + '#memory.add'.length
    textarea.setSelectionRange(keywordChipEnd, keywordChipEnd)
    Simulate.keyDown(textarea, { key: 'Backspace' })
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value.includes('#memory.add')) {
      throw new Error(`expected Backspace at #memory.add chip boundary to delete the projected keyword token, got ${JSON.stringify(textarea.value)}`)
    }
    const commandOnlyRaw = 'I can see #media /storybuilding'
    const commandOnlySlashEnd = commandOnlyRaw.indexOf('/storybuilding') + '/storybuilding'.length
    const commandOnlySlashDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: commandOnlyRaw,
      selectionStart: commandOnlySlashEnd,
      selectionEnd: commandOnlySlashEnd,
      direction: 'backward',
    })
    if (!commandOnlySlashDelete || commandOnlySlashDelete.text.includes('/storybuilding') || !commandOnlySlashDelete.text.includes('#media')) {
      throw new Error(`expected projected slash token deletion without media to preserve keyword text, got ${JSON.stringify(commandOnlySlashDelete)}`)
    }
    const commandOnlyKeywordEnd = commandOnlyRaw.indexOf('#media') + '#media'.length
    const commandOnlyKeywordDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: commandOnlyRaw,
      selectionStart: commandOnlyKeywordEnd,
      selectionEnd: commandOnlyKeywordEnd,
      direction: 'backward',
    })
    if (!commandOnlyKeywordDelete || commandOnlyKeywordDelete.text.includes('#media') || !commandOnlyKeywordDelete.text.includes('/storybuilding')) {
      throw new Error(`expected projected keyword token deletion without media to preserve slash text, got ${JSON.stringify(commandOnlyKeywordDelete)}`)
    }

    textarea.value = '#media'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mediaInvocationMenu = dom.window.document.querySelector('section[aria-label="Chat runtime invocations"]')
    const mediaInvocations = Array.from((mediaInvocationMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>)
      .filter(button => button.textContent?.includes('#media'))
    if (mediaInvocations.length !== 1) throw new Error(`expected one canonical #media invocation, got ${mediaInvocations.length}`)
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
