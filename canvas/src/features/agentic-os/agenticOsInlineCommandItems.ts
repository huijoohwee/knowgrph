import type { MarkdownInlineCommandMenuItem } from '@/lib/markdown-core/ui/markdownBlockContainerCore.commandMenu'
import { buildInlineCommandMenuItem } from '@/lib/command-menu/inlineCommandMenuItems'
import {
  buildAgenticOsDictionaryActionId,
  buildAgenticOsDocActionId,
  getAgenticOsCommandInvocations,
  getAgenticOsDocInvocations,
  getAgenticOsSemanticInvocations,
} from './agenticOsDocInvocations'

export const buildAgenticOsSlashInvocationActionMenuItems = (args: {
  onSelectActionId: (actionId: string) => void
}): MarkdownInlineCommandMenuItem[] => [
  ...getAgenticOsCommandInvocations().map(invocation => buildInlineCommandMenuItem({
    id: `agentic-os-command-${invocation.id}`,
    label: invocation.token,
    group: invocation.group,
    description: invocation.summary,
    keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
    onSelect: () => args.onSelectActionId(buildAgenticOsDictionaryActionId(invocation)),
  })),
]

export const buildAgenticOsSemanticInvocationActionMenuItems = (args: {
  onSelectActionId: (actionId: string) => void
}): MarkdownInlineCommandMenuItem[] => [
  ...getAgenticOsSemanticInvocations().map(invocation => buildInlineCommandMenuItem({
    id: `agentic-os-semantic-${invocation.id}`,
    label: invocation.token,
    group: invocation.group,
    description: invocation.summary,
    keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
    onSelect: () => args.onSelectActionId(buildAgenticOsDictionaryActionId(invocation)),
  })),
  ...getAgenticOsDocInvocations().map(doc => buildInlineCommandMenuItem({
    id: `agentic-os-doc-hash-${doc.id}`,
    label: doc.hashToken,
    group: 'Agentic OS docs',
    description: doc.summary,
    keywords: [doc.label, doc.slashCommand, doc.atToken, doc.sourcePath, ...doc.keywords],
    onSelect: () => args.onSelectActionId(buildAgenticOsDocActionId(doc)),
  })),
]
