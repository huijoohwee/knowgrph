import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { parseChatIngestUrlCommand } from '@/features/chat/chatCommandRegistry'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { buildKnowgrphVdeoxplnChatSystemPrompt, buildKnowgrphVdeoxplnRoutingPlan } from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
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
    return React.createElement(FloatingPanelChatComposer, {
      input,
      setInput,
      markdownText: '---\nproject: knowgrph\ncoverUrl: https://example.com/media/cover.png\n---\n# Brief',
      isLoading: false,
      isSubmitDisabled: false,
      uiPanelTextFontClass: 'text-sm',
      placeholder: 'Ask a question',
    })
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
    if (!textarea.value.includes('![Image: coverUrl](https://example.com/media/cover.png)')) {
      throw new Error(`expected @ media selection to insert the shared media embed, got ${JSON.stringify(textarea.value)}`)
    }
    const overlayChip = container.querySelector('[data-kg-chat-input-media-chip="1"] [data-kg-inline-command-thumbnail="image"] img') as HTMLImageElement | null
    if (!overlayChip) throw new Error(`expected Chat composer media embed to render through shared inline media chip overlay, html=${container.innerHTML}`)
    if (overlayChip.getAttribute('src') !== 'https://example.com/media/cover.png') {
      throw new Error(`expected Chat composer overlay thumbnail to preserve media URL, got ${JSON.stringify(overlayChip.getAttribute('src'))}`)
    }
    if (!String(textarea.getAttribute('class') || '').includes('text-transparent')) {
      throw new Error(`expected raw media markdown to stay textarea-owned but visually projected, class=${JSON.stringify(textarea.getAttribute('class'))}`)
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
