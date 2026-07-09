import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { parseChatIngestUrlCommand } from '@/features/chat/chatCommandRegistry'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { buildKnowgrphVdeoxplnChatSystemPrompt, buildKnowgrphVdeoxplnRoutingPlan } from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import {
  AGENTIC_OS_BINDING_INVOCATIONS,
  AGENTIC_OS_COMMAND_INVOCATIONS,
  AGENTIC_OS_DICTIONARY_INVOCATIONS,
  AGENTIC_OS_DOCS_GITHUB_ROOT_URL,
  AGENTIC_OS_DOC_INVOCATIONS,
  AGENTIC_OS_SEMANTIC_INVOCATIONS,
  KNOWGRPH_DOCS_GITHUB_ROOT_URL,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  deleteFloatingPanelChatComposerProjectedTokenDisplayRange,
} from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { replaceChatComposerTrigger, resolveChatComposerTrigger } from '@/features/chat/floatingPanelChat/chatComposerTrigger'
import { buildUploadedMediaInlineCommandCandidate } from '@/lib/command-menu/inlineUploadedMediaCandidates'
import type { UploadedMediaStorageResult } from '@/lib/storage/uploadedMediaStorage'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'
function readAgenticOsDictionaryEntries(fileName: string): string[] {
  const text = readFileSync(resolve(process.cwd(), '../../agentic-canvas-os/docs', fileName), 'utf8')
  const match = /^dictionary_entries:\n((?:[ ]{2}- .+\n)+)/m.exec(text)
  if (!match) throw new Error(`expected ${fileName} to expose dictionary_entries frontmatter`)
  return match[1].split(/\r?\n/).map(line => line.trim().replace(/^- /, '').replace(/^"|"$/g, '')).filter(Boolean)
}
export function testAgenticOsInvocationsUsePublicSourceLinks() {
  const invocations = [
    ...AGENTIC_OS_DOC_INVOCATIONS,
    ...AGENTIC_OS_DICTIONARY_INVOCATIONS,
  ]
  const allowedRoots = [AGENTIC_OS_DOCS_GITHUB_ROOT_URL, KNOWGRPH_DOCS_GITHUB_ROOT_URL]
  for (const invocation of invocations) {
    if (!allowedRoots.some(root => invocation.sourcePath.startsWith(`${root}/`))) {
      throw new Error(`expected ${invocation.id} to use GitHub source URL, got ${invocation.sourcePath}`)
    }
    if (invocation.sourcePath.includes('/Users/') || invocation.sourcePath.includes('localhost')) {
      throw new Error(`expected ${invocation.id} to avoid local source links, got ${invocation.sourcePath}`)
    }
  }
}
export function testFloatingPanelChatComposerTriggerRangesStayInlineAndNeutral() {
  const slash = resolveChatComposerTrigger('Review /story', 13)
  if (!slash || slash.kind !== 'slash' || slash.query !== 'story') {
    throw new Error(`expected slash trigger at the caret, got ${JSON.stringify(slash)}`)
  }
  const slashReplacement = replaceChatComposerTrigger({ text: 'Review /story', trigger: slash, replacement: '/storybuilding ' })
  if (slashReplacement.text !== 'Review /storybuilding ') {
    throw new Error(`expected only the active slash token to be replaced, got ${JSON.stringify(slashReplacement)}`)
  }
  const variable = resolveChatComposerTrigger('Use @pro', 8)
  if (!variable || variable.kind !== 'variable' || variable.query !== 'pro') {
    throw new Error(`expected variable trigger at the caret, got ${JSON.stringify(variable)}`)
  }
  const variableReplacement = replaceChatComposerTrigger({ text: 'Use @pro #media', trigger: variable, replacement: '![project](https://example.com/project.png)' })
  if (variableReplacement.text !== 'Use ![project](https://example.com/project.png) #media') {
    throw new Error(`expected shared @ token insertion to add one boundary space, got ${JSON.stringify(variableReplacement)}`)
  }
  const invocation = resolveChatComposerTrigger('Recall #memory.sea', 18)
  if (!invocation || invocation.kind !== 'keyword' || invocation.query !== 'memory.sea') {
    throw new Error(`expected runtime invocation trigger at the caret, got ${JSON.stringify(invocation)}`)
  }
  const invocationReplacement = replaceChatComposerTrigger({ text: 'Recall #memory.sea  next', trigger: invocation, replacement: '#memory.search ' })
  if (invocationReplacement.text !== 'Recall #memory.search next') throw new Error(`expected shared # token insertion to normalize trailing spacing, got ${JSON.stringify(invocationReplacement)}`)
}
export function testFloatingPanelChatIngestCommandUsesSharedRegistryParser() {
  const parsed = parseChatIngestUrlCommand('/ingest-url https://example.com/source.md')
  if (parsed?.url !== 'https://example.com/source.md') {
    throw new Error(`expected canonical ingest command parsing, got ${JSON.stringify(parsed)}`)
  }
  if (parseChatIngestUrlCommand('ingest-url https://example.com/source.md') !== null) {
    throw new Error('expected URL ingest parsing to require the canonical slash command')
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
  const agenticOsPrompt = buildChatInvocationSystemPrompt({
    userQuery: 'Use /agentic-os.runtime with #agentic-os.runtime, #frontmatter, and @agentic-os.runtime.',
    chatProvider: 'openai',
    chatModel: 'gpt-5-nano',
  })
  for (const expected of ['#agentic-os.runtime', '#frontmatter', 'RUNTIME-READINESS.md', 'DICTIONARY-SEMANTIC.md', 'do not authorize Prod or Cloudflare deployment']) if (!agenticOsPrompt.includes(expected)) throw new Error(`expected Agentic OS invocation prompt to include ${expected}`)
  const agenticOsOverlay = buildFloatingPanelChatComposerOverlayParts('/agentic-os.runtime /runtime-ready.check #agentic-os.runtime #frontmatter @agentic-os.runtime @operator')
  const agenticOsOverlayTokens = agenticOsOverlay.parts.flatMap(part => part.kind === 'invocation' ? [`${part.tokenKind}:${part.text}`] : [])
  if (!agenticOsOverlay.hasOverlay || JSON.stringify(agenticOsOverlayTokens) !== JSON.stringify(['slash:/agentic-os.runtime', 'slash:/runtime-ready.check', 'keyword:#agentic-os.runtime', 'keyword:#frontmatter', 'binding:@agentic-os.runtime', 'binding:@operator'])) {
    throw new Error(`expected /, #, and @ Agentic OS tokens to render invocation chip metrics, got ${JSON.stringify(agenticOsOverlay)}`)
  }
  const chatRegistryOverlay = buildFloatingPanelChatComposerOverlayParts('/ingest-url #memory.add')
  const chatRegistryOverlayTokens = chatRegistryOverlay.parts.flatMap(part => part.kind === 'invocation' ? [`${part.tokenKind}:${part.text}`] : [])
  if (!chatRegistryOverlay.hasOverlay || JSON.stringify(chatRegistryOverlayTokens) !== JSON.stringify(['slash:/ingest-url', 'keyword:#memory.add'])) {
    throw new Error(`expected command-only / and # input to render shared invocation chips, got ${JSON.stringify(chatRegistryOverlay)}`)
  }
  const commandTokens = AGENTIC_OS_COMMAND_INVOCATIONS.map(invocation => invocation.token)
  const semanticTokens = AGENTIC_OS_SEMANTIC_INVOCATIONS.map(invocation => invocation.token)
  const bindingTokens = AGENTIC_OS_BINDING_INVOCATIONS.map(invocation => invocation.token)
  for (const [fileName, actualTokens] of [
    ['DICTIONARY-COMMAND.md', commandTokens],
    ['DICTIONARY-SEMANTIC.md', semanticTokens],
    ['DICTIONARY-BINDING.md', bindingTokens],
  ] as const) {
    const expectedTokens = readAgenticOsDictionaryEntries(fileName)
    if (JSON.stringify(actualTokens) !== JSON.stringify(expectedTokens)) {
      throw new Error(`expected shared Agentic OS invocation catalog to mirror ${fileName}, expected=${JSON.stringify(expectedTokens)} actual=${JSON.stringify(actualTokens)}`)
    }
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
    const storybuildingInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/storybuilding"]')
    if (storybuildingChip || !storybuildingInvocationChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !String(textarea.getAttribute('class') || '').includes('text-transparent') || !storybuildingInvocationChip.getAttribute('title')?.includes('chat skill registry') || !String(storybuildingInvocationChip.getAttribute('class') || '').includes('pointer-events-auto')) {
      throw new Error(`expected selected /storybuilding token to render through shared invocation chips, html=${container.innerHTML}`)
    }
    textarea.value = '/runtime'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const agenticSlashMenu = dom.window.document.querySelector('section[aria-label="Chat slash commands"]')
    const runtimeReadyCommand = Array.from((agenticSlashMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('/runtime-ready.check'))
    if (!runtimeReadyCommand) throw new Error('expected slash menu to expose Agentic OS /runtime-ready.check')
    runtimeReadyCommand.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '/runtime-ready.check ') {
      throw new Error(`expected Agentic OS slash selection to insert only the invocation token, got ${JSON.stringify(textarea.value)}`)
    }
    const runtimeRawInput = container.querySelector('[data-kg-test-chat-raw-input="true"]') as HTMLOutputElement | null
    if (String(runtimeRawInput?.textContent || '').includes('https://github.com/') || textarea.value.includes('DICTIONARY-COMMAND.md')) {
      throw new Error(`expected Agentic OS slash selection to keep source URL in chip metadata only, raw=${JSON.stringify(runtimeRawInput?.textContent || '')} visible=${JSON.stringify(textarea.value)}`)
    }
    const runtimeReadyChip = container.querySelector('[data-kg-agentic-os-invocation-chip="1"][data-kg-agentic-os-invocation-token="/runtime-ready.check"]')
    if (!runtimeReadyChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !runtimeReadyChip.getAttribute('title')?.includes('DICTIONARY-COMMAND.md')) {
      throw new Error(`expected selected /runtime-ready.check to render through shared Agentic OS invocation chips, html=${container.innerHTML}`)
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
    if (textarea.value !== '{{project}} ') {
      throw new Error(`expected @ selection to insert the shared variable token with one trailing space, got ${JSON.stringify(textarea.value)}`)
    }
    textarea.value = '@oper'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const agenticBindingMenu = dom.window.document.querySelector('section[aria-label="Chat variable commands"]')
    const operatorBinding = Array.from((agenticBindingMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('@operator'))
    if (!operatorBinding) throw new Error('expected @ menu to expose Agentic OS @operator')
    operatorBinding.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '@operator ') {
      throw new Error(`expected Agentic OS @ selection to insert only the binding token, got ${JSON.stringify(textarea.value)}`)
    }
    const operatorChip = container.querySelector('[data-kg-agentic-os-invocation-chip="1"][data-kg-agentic-os-invocation-token="@operator"]')
    if (!operatorChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !operatorChip.getAttribute('title')?.includes('DICTIONARY-BINDING.md')) {
      throw new Error(`expected selected @operator to render through shared Agentic OS invocation chips, html=${container.innerHTML}`)
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
    const overlayMediaChip = overlayChipThumbnail.closest('[data-kg-chat-input-media-chip="1"]')
    if (!overlayMediaChip?.getAttribute('data-kg-chat-input-media-source')?.includes('https://example.com/media/cover.png') || !overlayMediaChip.getAttribute('title')?.includes('Source: https://example.com/media/cover.png')) {
      throw new Error(`expected Chat composer media chip to expose hover source metadata, got ${JSON.stringify(overlayMediaChip?.outerHTML || '')}`)
    }
    if (!overlayMediaChip.querySelector('.kg-inline-chip-label-15ch')) {
      throw new Error(`expected Chat composer @ media chip label to use shared 15ch truncation, html=${overlayMediaChip.outerHTML}`)
    }
    const mediaMetricToken = container.querySelector('[data-kg-chat-input-media-metric="preserve"]')
    if (!mediaMetricToken) throw new Error(`expected Chat composer media chip to reserve textarea display metrics, html=${container.innerHTML}`)
    if (!String(textarea.getAttribute('class') || '').includes('text-transparent') || !String(textarea.getAttribute('class') || '').includes('z-0') || !String(textarea.getAttribute('class') || '').includes('kg-floating-chat-composer-projected') || !String(textarea.closest('.kg-multiline-text-input-editor')?.getAttribute('class') || '').includes('kg-floating-chat-composer-projected')) {
      throw new Error(`expected projected media chips to own composer visuals while textarea keeps raw display metrics, class=${JSON.stringify(textarea.getAttribute('class'))}`)
    }
    const mediaOverlay = container.querySelector('[data-kg-chat-input-media-overlay="1"]') as HTMLElement | null
    if (!mediaOverlay || String(mediaOverlay.getAttribute('class') || '').includes('text-transparent') || !String(mediaOverlay.getAttribute('class') || '').includes('z-10') || !String(mediaOverlay.getAttribute('class') || '').includes('kg-floating-chat-composer-projected')) {
      throw new Error(`expected Chat composer overlay to own visible projected chip output, html=${container.innerHTML}`)
    }
    if (!String(overlayMediaChip.getAttribute('class') || '').includes('bg-[color:var(--kg-panel-bg)]')) {
      throw new Error(`expected Chat composer media chip to cover the textarea-owned @ media placeholder, got ${JSON.stringify(overlayMediaChip.outerHTML)}`)
    }
    const overlayMediaChipClass = String(overlayMediaChip.getAttribute('class') || '')
    if (overlayMediaChipClass.includes('pointer-events-none') || !overlayMediaChipClass.includes('pointer-events-auto') || !overlayMediaChipClass.includes('cursor-help')) {
      throw new Error(`expected Chat composer media chip to expose hover metadata through a visible hit target, got ${JSON.stringify(overlayMediaChip.outerHTML)}`)
    }
    if (textarea.getAttribute('data-kg-chat-input-media-overlay-active') !== '1') {
      throw new Error(`expected media-chip composer textarea to expose the media overlay contract, got ${JSON.stringify(textarea.outerHTML)}`)
    }
    const overlay = container.querySelector('[data-kg-chat-input-media-overlay="1"]') as HTMLElement | null
    if (!overlay) throw new Error('expected Chat composer media overlay')
    const overlayText = String(overlay.textContent || '')
    if (overlayText.includes('https://example.com/media/cover.png') || overlayText.includes('![')) {
      throw new Error(`expected Chat composer overlay to project compact media chip text instead of raw markdown, got ${JSON.stringify(overlayText)}`)
    }
    const mediaOnlyDisplayText = textarea.value
    textarea.value = `I can /prd-tad.create the #media at ${mediaOnlyDisplayText}, that sounds great! so we can`
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mixedRawText = String(rawInput.textContent || '')
    if (!mixedRawText.includes('I can /prd-tad.create the #media at ![Image: coverUrl](https://example.com/media/cover.png) , that sounds great! so we can')) {
      throw new Error(`expected mixed / # @ composer input to preserve raw media and command tokens, got ${JSON.stringify(mixedRawText)}`)
    }
    const mixedSlashChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/prd-tad.create"]')
    const mixedKeywordChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#media"]')
    const mixedSlashMetric = container.querySelector('[data-kg-chat-input-invocation-metric="preserve"][data-kg-chat-input-invocation-kind="slash"][data-kg-chat-input-invocation-token="/prd-tad.create"]')
    const mixedKeywordMetric = container.querySelector('[data-kg-chat-input-invocation-metric="preserve"][data-kg-chat-input-invocation-kind="keyword"][data-kg-chat-input-invocation-token="#media"]')
    const mixedSlashInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/prd-tad.create"]')
    const mixedKeywordInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#media"]')
    const mixedMediaMetricToken = container.querySelector('[data-kg-chat-input-media-metric="preserve"]')
    const mixedMediaChipThumbnail = container.querySelector('[data-kg-chat-input-media-chip="1"] [data-kg-inline-command-thumbnail="image"] img') as HTMLImageElement | null
    if (mixedSlashChip || mixedKeywordChip || !mixedSlashMetric || !mixedKeywordMetric || !mixedSlashInvocationChip || !mixedKeywordInvocationChip || !mixedMediaMetricToken || !mixedMediaChipThumbnail || !mixedSlashInvocationChip.getAttribute('title')?.includes('DICTIONARY-COMMAND.md') || !mixedKeywordInvocationChip.getAttribute('title')?.includes('Media context')) {
      throw new Error(`expected mixed / # @ composer input to render hoverable shared invocation and media chips, html=${container.innerHTML}`)
    }
    if (!mixedSlashInvocationChip.querySelector('[data-kg-textarea-invocation-token-sigil="/"]') || !mixedKeywordInvocationChip.querySelector('[data-kg-textarea-invocation-token-sigil="#"]')) {
      throw new Error(`expected mixed / and # composer chips to preserve visible sigils under truncation, html=${container.innerHTML}`)
    }
    for (const invocationChip of [mixedSlashInvocationChip, mixedKeywordInvocationChip]) {
      const label = invocationChip.querySelector('[data-kg-textarea-invocation-token-label="1"]')
      if (!String(label?.getAttribute('class') || '').includes('kg-inline-chip-label-15ch')) {
        throw new Error(`expected mixed / and # composer chip labels to use shared 15ch truncation, html=${invocationChip.outerHTML}`)
      }
      if (!String(invocationChip.getAttribute('class') || '').includes('kg-inline-chip-shell-15ch')) {
        throw new Error(`expected mixed / and # composer chip shells to fit truncated labels without empty right-side width, html=${invocationChip.outerHTML}`)
      }
    }
    if (mixedMediaChipThumbnail.getAttribute('src') !== 'https://example.com/media/cover.png') {
      throw new Error(`expected mixed / # @ composer media chip to preserve its shared thumbnail renderer, got ${JSON.stringify(mixedMediaChipThumbnail.outerHTML)}`)
    }
    const mixedKeywordBoundary = textarea.value.indexOf('#media') + '#media'.length
    textarea.setSelectionRange(mixedKeywordBoundary, mixedKeywordBoundary); Simulate.select(textarea); await waitForFrames(dom.window as unknown as Window, 2)
    const mixedKeywordProjectedCaret = container.querySelector('[data-kg-textarea-invocation-projected-caret="1"][data-kg-textarea-invocation-projected-caret-kind="keyword"][data-kg-textarea-invocation-projected-caret-token="#media"]')
    if (!mixedKeywordProjectedCaret?.closest('[data-kg-chat-input-invocation-metric="preserve"]')) {
      throw new Error(`expected # keyword selection to render the shared projected caret marker inside the overlay chip, html=${container.innerHTML}`)
    }
    const mixedSlashBoundary = textarea.value.indexOf('/prd-tad.create') + '/prd-tad.create '.length
    textarea.setSelectionRange(mixedSlashBoundary, mixedSlashBoundary); Simulate.select(textarea); await waitForFrames(dom.window as unknown as Window, 2)
    if (!String(textarea.getAttribute('class') || '').includes('caret-transparent')) throw new Error(`expected / route caret to be hidden while overlay chip owns the visible token, class=${JSON.stringify(textarea.getAttribute('class'))}`)
    const mixedSlashProjectedCaret = container.querySelector('[data-kg-textarea-invocation-projected-caret="1"][data-kg-textarea-invocation-projected-caret-kind="slash"][data-kg-textarea-invocation-projected-caret-token="/prd-tad.create"]')
    if (!mixedSlashProjectedCaret?.closest('[data-kg-chat-input-invocation-metric="preserve"]')) {
      throw new Error(`expected / route hidden native caret to get a shared projected caret marker, html=${container.innerHTML}`)
    }
    Simulate.keyDown(textarea, { key: 'a', metaKey: true })
    if (textarea.selectionStart !== 0 || textarea.selectionEnd !== textarea.value.length || String(textarea.getAttribute('class') || '').includes('selection:bg-transparent')) {
      throw new Error(`expected Cmd+A to select the projected composer display text visibly, selection=${textarea.selectionStart}:${textarea.selectionEnd} class=${JSON.stringify(textarea.getAttribute('class'))}`)
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
    const chipSlashInvocationToken = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/storybuilding"]')
    if (chipSlashToken || !chipSlashInvocationToken || !chipSlashInvocationToken.getAttribute('title')?.includes('chat skill registry')) {
      throw new Error(`expected /storybuilding after compact media to render as a shared invocation chip, html=${container.innerHTML}`)
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
    const chipKeywordInvocationToken = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#memory.search"]')
    if (chipKeywordToken || !chipKeywordInvocationToken || !chipKeywordInvocationToken.getAttribute('title')?.includes('knowgrph.memory.search')) {
      throw new Error(`expected #memory.search after compact media to render as a shared invocation chip, html=${container.innerHTML}`)
    }
    const mixedMediaLabel = mediaOnlyDisplayText.trim()
    const mixedMediaLabelStart = textarea.value.indexOf(mixedMediaLabel)
    if (mixedMediaLabelStart < 0) throw new Error(`expected mixed composer display to contain media label ${JSON.stringify(mixedMediaLabel)}, got ${JSON.stringify(textarea.value)}`)
    const mixedMediaLabelEnd = mixedMediaLabelStart + mixedMediaLabel.length
    textarea.setSelectionRange(mixedMediaLabelEnd, mixedMediaLabelEnd)
    Simulate.select(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const mixedMediaProjectedCaret = container.querySelector('[data-kg-textarea-invocation-projected-caret="1"][data-kg-textarea-invocation-projected-caret-kind="media"]')
    if (!mixedMediaProjectedCaret?.closest('[data-kg-chat-input-media-metric="preserve"]')) {
      throw new Error(`expected @ media selection to render the shared projected caret marker inside the overlay chip, html=${container.innerHTML}`)
    }
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
    const postDeleteSlashInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/storybuilding"]')
    const postDeleteKeywordInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#memory.search"]')
    if (postDeleteSlashChip || postDeleteKeywordChip || !postDeleteSlashInvocationChip || !postDeleteKeywordInvocationChip) {
      throw new Error(`expected deleting mixed @ media chip to preserve / and # invocation chips, html=${container.innerHTML}`)
    }
    const adjacentRawMedia = 'I can ![Image: coverUrl](https://example.com/media/cover.png) after /storybuilding #memory.search '
    const adjacentDisplayMedia = buildFloatingPanelChatComposerDisplayText(adjacentRawMedia)
    const adjacentMediaLabelStart = adjacentDisplayMedia.indexOf(mixedMediaLabel)
    if (adjacentMediaLabelStart < 0) throw new Error(`expected adjacent-delete display to contain media label ${JSON.stringify(mixedMediaLabel)}, got ${JSON.stringify(adjacentDisplayMedia)}`)
    const adjacentMediaLabelEnd = adjacentMediaLabelStart + mixedMediaLabel.length
    const adjacentDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({ text: adjacentRawMedia, selectionStart: adjacentMediaLabelEnd + 1, selectionEnd: adjacentMediaLabelEnd + 1, direction: 'backward' })
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
    const memorySearchInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#memory.search"]')
    if (memorySearchChip || !memorySearchInvocationChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !String(textarea.getAttribute('class') || '').includes('text-transparent') || !memorySearchInvocationChip.getAttribute('title')?.includes('knowgrph.memory.search')) {
      throw new Error(`expected selected #memory.search token to render through shared invocation chips, html=${container.innerHTML}`)
    }
    textarea.value = '#mc'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const agenticSemanticMenu = dom.window.document.querySelector('section[aria-label="Chat runtime invocations"]')
    const mcpSemantic = Array.from((agenticSemanticMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('#mcp'))
    if (!mcpSemantic) throw new Error('expected # menu to expose Agentic OS #mcp')
    mcpSemantic.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== '#mcp ') {
      throw new Error(`expected Agentic OS # selection to insert only the semantic token, got ${JSON.stringify(textarea.value)}`)
    }
    const mcpChip = container.querySelector('[data-kg-agentic-os-invocation-chip="1"][data-kg-agentic-os-invocation-token="#mcp"]')
    if (!mcpChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !mcpChip.getAttribute('title')?.includes('DICTIONARY-SEMANTIC.md')) {
      throw new Error(`expected selected #mcp to render through shared Agentic OS invocation chips, html=${container.innerHTML}`)
    }
    textarea.value = '/runtime-ready.check #frontmatter @operator'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    const agenticOsComposerChips = Array.from(container.querySelectorAll('[data-kg-agentic-os-invocation-chip="1"]')) as HTMLElement[]
    const agenticOsComposerTokens = agenticOsComposerChips.map(chip => chip.getAttribute('data-kg-agentic-os-invocation-token') || '')
    if (JSON.stringify(agenticOsComposerTokens) !== JSON.stringify(['/runtime-ready.check', '#frontmatter', '@operator']) || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1') {
      throw new Error(`expected Chat composer to render /, #, and @ Agentic OS invocation chips, html=${container.innerHTML}`)
    }
    const operatorBoundary = textarea.value.indexOf('@operator') + '@operator'.length
    textarea.setSelectionRange(operatorBoundary, operatorBoundary); Simulate.select(textarea); await waitForFrames(dom.window as unknown as Window, 2)
    const operatorProjectedCaret = container.querySelector('[data-kg-textarea-invocation-projected-caret="1"][data-kg-textarea-invocation-projected-caret-kind="binding"][data-kg-textarea-invocation-projected-caret-token="@operator"]')
    if (!operatorProjectedCaret?.closest('[data-kg-chat-input-invocation-metric="preserve"]')) {
      throw new Error(`expected @ binding selection to render the shared projected caret marker inside the overlay chip, html=${container.innerHTML}`)
    }
    const operatorInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="binding"][data-kg-chat-input-invocation-token="@operator"]')
    if (!operatorInvocationChip?.querySelector('[data-kg-textarea-invocation-token-sigil="@"]')) {
      throw new Error(`expected @ binding composer chip to preserve its visible sigil under truncation, html=${container.innerHTML}`)
    }
    textarea.value = 'i can #memory.add , /ingest-url'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
    await waitForFrames(dom.window as unknown as Window, 2)
    if (textarea.value !== 'i can #memory.add , /ingest-url') {
      throw new Error(`expected registry token chips to preserve raw visible text, got ${JSON.stringify(textarea.value)}`)
    }
    const memoryAddChip = container.querySelector('[data-kg-chat-input-command-chip="keyword"][data-kg-chat-input-command-token="#memory.add"]')
    const slashIngestUrlChip = container.querySelector('[data-kg-chat-input-command-chip="slash"][data-kg-chat-input-command-token="/ingest-url"]')
    const memoryAddInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#memory.add"]')
    const slashIngestUrlInvocationChip = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/ingest-url"]')
    if (memoryAddChip || slashIngestUrlChip || !memoryAddInvocationChip || !slashIngestUrlInvocationChip || textarea.getAttribute('data-kg-chat-input-overlay-active') !== '1' || !memoryAddInvocationChip.getAttribute('title')?.includes('knowgrph.memory.add') || !slashIngestUrlInvocationChip.getAttribute('title')?.includes('DICTIONARY-COMMAND.md')) {
      throw new Error(`expected #memory.add and /ingest-url to render through shared invocation chips, html=${container.innerHTML}`)
    }
    const commandOnlyRaw = 'I can see #media /storybuilding'
    const commandOnlySlashEnd = commandOnlyRaw.indexOf('/storybuilding') + '/storybuilding'.length
    const commandOnlySlashDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: commandOnlyRaw,
      selectionStart: commandOnlySlashEnd,
      selectionEnd: commandOnlySlashEnd,
      direction: 'backward',
    })
    if (commandOnlySlashDelete !== null) {
      throw new Error(`expected projected slash deletion to be disabled for command-only text, got ${JSON.stringify(commandOnlySlashDelete)}`)
    }
    const commandOnlyKeywordEnd = commandOnlyRaw.indexOf('#media') + '#media'.length
    const commandOnlyKeywordDelete = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: commandOnlyRaw,
      selectionStart: commandOnlyKeywordEnd,
      selectionEnd: commandOnlyKeywordEnd,
      direction: 'backward',
    })
    if (commandOnlyKeywordDelete !== null) {
      throw new Error(`expected projected keyword deletion to be disabled for command-only text, got ${JSON.stringify(commandOnlyKeywordDelete)}`)
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
