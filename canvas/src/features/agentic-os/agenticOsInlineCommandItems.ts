import type { MarkdownInlineCommandMenuItem } from '@/lib/markdown-core/ui/markdownBlockContainerCore.commandMenu'
import { buildInlineCommandMenuItem } from '@/lib/command-menu/inlineCommandMenuItems'
import {
  AGENTIC_OS_BINDING_INVOCATIONS,
  AGENTIC_OS_COMMAND_INVOCATIONS,
  AGENTIC_OS_DOC_INVOCATIONS,
  AGENTIC_OS_SEMANTIC_INVOCATIONS,
  buildAgenticOsDictionaryActionId,
  buildAgenticOsDictionaryInvocationMarkdown,
  buildAgenticOsDocActionId,
  buildAgenticOsDocBindingInvocationMarkdown,
  buildAgenticOsDocInvocationMarkdown,
} from './agenticOsDocInvocations'

export const buildAgenticOsSlashInvocationMenuItems = (args: {
  onSelect: (replacement: string) => void
}): MarkdownInlineCommandMenuItem[] => [
  ...AGENTIC_OS_COMMAND_INVOCATIONS.map(invocation => buildInlineCommandMenuItem({
    id: `agentic-os-command-${invocation.id}`,
    label: invocation.token,
    group: invocation.group,
    description: invocation.summary,
    keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
    onSelect: () => args.onSelect(buildAgenticOsDictionaryInvocationMarkdown(invocation)),
  })),
]

export const buildAgenticOsSlashInvocationActionMenuItems = (args: {
  onSelectActionId: (actionId: string) => void
}): MarkdownInlineCommandMenuItem[] => [
  ...AGENTIC_OS_COMMAND_INVOCATIONS.map(invocation => buildInlineCommandMenuItem({
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
  ...AGENTIC_OS_SEMANTIC_INVOCATIONS.map(invocation => buildInlineCommandMenuItem({
    id: `agentic-os-semantic-${invocation.id}`,
    label: invocation.token,
    group: invocation.group,
    description: invocation.summary,
    keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
    onSelect: () => args.onSelectActionId(buildAgenticOsDictionaryActionId(invocation)),
  })),
  ...AGENTIC_OS_DOC_INVOCATIONS.map(doc => buildInlineCommandMenuItem({
    id: `agentic-os-doc-hash-${doc.id}`,
    label: doc.hashToken,
    group: 'Agentic OS docs',
    description: doc.summary,
    keywords: [doc.label, doc.slashCommand, doc.atToken, doc.sourcePath, ...doc.keywords],
    onSelect: () => args.onSelectActionId(buildAgenticOsDocActionId(doc)),
  })),
]

export const buildAgenticOsBindingInvocationMenuItems = (args: {
  queryKey?: string
  onSelect: (replacement: string) => void
}): MarkdownInlineCommandMenuItem[] => {
  const query = String(args.queryKey || '').trim().toLowerCase()
  const matches = (values: readonly string[]): boolean => !query || values.some(value => value.toLowerCase().includes(query))
  return [
    ...AGENTIC_OS_BINDING_INVOCATIONS
      .filter(invocation => matches([invocation.token, invocation.label, invocation.sourcePath, ...invocation.keywords]))
      .map(invocation => buildInlineCommandMenuItem({
        id: `agentic-os-binding-${invocation.id}`,
        label: invocation.token,
        group: invocation.group,
        description: invocation.summary,
        keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
        onSelect: () => args.onSelect(buildAgenticOsDictionaryInvocationMarkdown(invocation)),
      })),
    ...AGENTIC_OS_DOC_INVOCATIONS
      .filter(doc => matches([doc.atToken, doc.label, doc.sourcePath, ...doc.keywords]))
      .map(doc => buildInlineCommandMenuItem({
        id: `agentic-os-doc-at-${doc.id}`,
        label: doc.atToken,
        group: 'Agentic OS docs',
        description: doc.summary,
        keywords: [doc.label, doc.slashCommand, doc.hashToken, doc.sourcePath, ...doc.keywords],
        onSelect: () => args.onSelect(buildAgenticOsDocBindingInvocationMarkdown(doc)),
      })),
  ]
}
