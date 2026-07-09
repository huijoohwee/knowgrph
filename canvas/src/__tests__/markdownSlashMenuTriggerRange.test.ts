import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  AGENTIC_OS_COMMAND_INVOCATIONS,
  AGENTIC_OS_DOC_INVOCATIONS,
  buildAgenticOsDictionaryInvocationMarkdown,
  buildAgenticOsDocBindingInvocationMarkdown,
  buildAgenticOsDocInvocationMarkdown,
  buildAgenticOsDocSemanticInvocationMarkdown,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { buildAgenticOsSlashInvocationMenuItems } from '@/features/agentic-os/agenticOsInlineCommandItems'
import { toStableSlashMenuState } from '@/lib/markdown-core/ui/markdownBlockContainerCore.menuState'

const readUtf8 = (filePath: string) => readFileSync(filePath, 'utf8')

export function testMarkdownSlashMenuActionsReuseTriggerRangeAfterMenuFocus() {
  const root = process.cwd()
  const menuState = toStableSlashMenuState(
    { show: false, leftPx: 0, topPx: 0 },
    {
      show: true,
      leftPx: 10,
      topPx: 20,
      kind: 'slash',
      query: '',
      triggerRange: { startOffset: 12, endOffset: 13 },
    },
  )
  if (menuState.triggerRange?.startOffset !== 12 || menuState.triggerRange.endOffset !== 13) {
    throw new Error(`expected slash menu state to preserve trigger range, got ${JSON.stringify(menuState.triggerRange)}`)
  }

  const overlayText = readUtf8(path.resolve(root, 'src', 'lib', 'markdown-core', 'ui', 'markdownBlockContainerCore.inlineMenusOverlay.tsx'))
  if (!overlayText.includes('applyTurnInto(actionId, props.slashMenu.triggerRange || null)')) {
    throw new Error('expected Agentic OS slash menu actions to pass the captured trigger range into applyTurnInto')
  }

  const formattingText = readUtf8(path.resolve(root, 'src', 'lib', 'markdown-core', 'ui', 'markdownBlockContainerCore.markdownFormatting.ts'))
  if (!formattingText.includes('triggerSelection || args.readSelectionOffsetsForFormatting() || args.getSelectionOffsets()')) {
    throw new Error('expected Agentic OS insertion to prefer captured slash trigger selection before live menu-focus selection')
  }

  const harnessDoc = AGENTIC_OS_DOC_INVOCATIONS.find(doc => doc.id === 'agentic-os.harness')
  if (!harnessDoc) throw new Error('expected Agentic OS harness doc invocation to exist')
  if (buildAgenticOsDocInvocationMarkdown(harnessDoc) !== '/agentic-os.harness') {
    throw new Error('expected slash doc insertion to persist the canonical slash token only')
  }
  if (buildAgenticOsDocSemanticInvocationMarkdown(harnessDoc) !== '#agentic-os.harness') {
    throw new Error('expected semantic doc insertion to persist the canonical hash token only')
  }
  if (buildAgenticOsDocBindingInvocationMarkdown(harnessDoc) !== '@agentic-os.harness') {
    throw new Error('expected binding doc insertion to persist the canonical at token only')
  }

  const prdTadInvocation = AGENTIC_OS_COMMAND_INVOCATIONS.find(invocation => invocation.token === '/prd-tad.create')
  if (!prdTadInvocation) throw new Error('expected Agentic OS command dictionary to expose /prd-tad.create')
  if (buildAgenticOsDictionaryInvocationMarkdown(prdTadInvocation) !== '/prd-tad.create') {
    throw new Error('expected dictionary command insertion to persist the canonical slash token only')
  }
  const selectedReplacements: string[] = []
  const prdTadMenuItem = buildAgenticOsSlashInvocationMenuItems({
    onSelect: replacement => selectedReplacements.push(replacement),
  }).find(item => item.label === '/prd-tad.create')
  if (!prdTadMenuItem) throw new Error('expected card slash command menu to expose /prd-tad.create')
  prdTadMenuItem.onSelect()
  if (selectedReplacements.join('|') !== '/prd-tad.create') {
    throw new Error(`expected card slash command menu to insert only /prd-tad.create, got ${JSON.stringify(selectedReplacements)}`)
  }
  if (selectedReplacements.some(replacement => /https?:\/\//.test(replacement))) {
    throw new Error(`expected card slash command menu not to persist invocation source URLs, got ${JSON.stringify(selectedReplacements)}`)
  }
}
