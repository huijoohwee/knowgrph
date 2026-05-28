import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from '@/features/chat/chatWorkspaceMirror'
import { resolveShareUrlArtifactPaths, isShareUrlArtifactEligible } from '@/features/chat/shareUrlArtifacts'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { buildShareThinkingArtifactDocument } from '@/features/chat/shareThinkingArtifact'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'

const stripLeadingFrontmatter = (value: string): string => {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return text
  const closingIndex = text.indexOf('\n---\n', 4)
  if (closingIndex < 0) return text
  return text.slice(closingIndex + 5).trim()
}

const uniqueText = (values: readonly string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  values.forEach(value => {
    const text = String(value || '').trim()
    if (!text) return
    const key = text.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(text)
  })
  return out
}

const clampText = (value: unknown, maxLength: number): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : text
}

const cleanRecoveredPrompt = (value: string): string => {
  return String(value || '')
    .replace(/\bshow\s+thinking\s+trajectory\b/gi, '')
    .replace(/\bsummary\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const IMPORTED_SHARE_NAMED_TERM_PREFIX_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'from',
  'in',
  'of',
  'or',
  'the',
  'to',
  'what',
  'why',
  'how',
  'when',
  'where',
  'which',
  'phase',
  'week',
  'weeks',
  'month',
  'months',
  'quarter',
  'summary',
  'shared',
])

const IMPORTED_SHARE_GENERIC_NAMED_TERMS = new Set([
  'MiroMind',
  'Share',
  'MiroMind Share',
  'Import URL',
  'Workspace',
  'Source Files',
  'Summary',
])

const normalizeImportedShareFocusLine = (value: string): string => {
  return clampText(
    String(value || '')
      .replace(/^\d+(?:\.\d+)*[.)]?\s+/g, '')
      .replace(/^phase\s+\d+\s*[-–:]\s*/i, '')
      .replace(/^step\s+\d+\s*[-–:]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
    220,
  )
}

const extractImportedShareNamedTerms = (value: string, maxCount = 6): string[] => {
  const matches = String(value || '').match(/\b(?:[A-Z]{2,}(?:\s+[A-Z]{2,}){0,2}|[A-Z][A-Za-z]+(?:[-'][A-Za-z]+)?(?:\s+(?:&|[A-Z][A-Za-z]+(?:[-'][A-Za-z]+)?|[A-Z]{2,})){0,4})\b/g) || []
  const extracted = uniqueText(
    matches
      .map(match => String(match || '').replace(/\s+/g, ' ').trim())
      .map(match => match.replace(/^(?:and|or)\s+/i, '').replace(/\s+(?:and|or)$/i, '').trim())
      .filter(match => {
        if (!match || IMPORTED_SHARE_GENERIC_NAMED_TERMS.has(match)) return false
        const words = match.split(/\s+/).filter(Boolean)
        if (words.length === 0 || words.length > 5) return false
        const firstWord = words[0]?.toLowerCase() || ''
        if (IMPORTED_SHARE_NAMED_TERM_PREFIX_STOPWORDS.has(firstWord)) return false
        if (words.some(word => /^[0-9]+$/.test(word))) return false
        if (words.length === 1 && !/^[A-Z]{2,}$/.test(match) && !/[a-z][A-Z]/.test(match)) return false
        return true
      }),
  )
  return extracted.filter(term => {
    if (/^[A-Z]{2}$/.test(term)) return false
    const lowered = term.toLowerCase()
    const coveredByOtherTerms = extracted.filter(other => {
      if (other === term) return false
      const otherLowered = other.toLowerCase()
      return otherLowered.length >= 3 && lowered.includes(otherLowered)
    }).length
    if ((/[&/]/.test(term) || term.split(/\s+/).length >= 3) && coveredByOtherTerms >= 2) return false
    return true
  }).slice(0, maxCount)
}

const buildImportedShareQueryRelevanceOverride = (args: {
  recoveredPrompt: string
  headingLines: string[]
  referenceLines: string[]
  narrativeLines: string[]
}): {
  focus?: string
  namedTerms?: string[]
} => {
  const namedTerms = extractImportedShareNamedTerms([
    args.recoveredPrompt,
    ...args.headingLines,
    ...args.referenceLines,
    ...args.narrativeLines,
  ].join('\n'))
  const focusCandidate = [
    ...args.headingLines.map(normalizeImportedShareFocusLine),
    ...args.narrativeLines.map(normalizeImportedShareFocusLine),
    normalizeImportedShareFocusLine(args.recoveredPrompt),
  ].find(Boolean) || ''
  const focus = !focusCandidate
    ? ''
    : namedTerms.length > 0 && !namedTerms.some(term => focusCandidate.toLowerCase().includes(term.toLowerCase()))
      ? clampText(`${namedTerms.slice(0, 3).join(', ')} · ${focusCandidate}`, 260)
      : focusCandidate
  return {
    focus: focus || undefined,
    namedTerms: namedTerms.length > 0 ? namedTerms : undefined,
  }
}

const extractImportedSharePrompt = (args: { url: string; importedText: string }): string => {
  const body = stripLeadingFrontmatter(args.importedText)
  const lines = body.split('\n').map(line => String(line || '').trim()).filter(Boolean)
  let titleHeadingConsumed = false
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      if (!titleHeadingConsumed && /^#\s+/.test(line)) {
        titleHeadingConsumed = true
        continue
      }
      break
    }
    if (/^\[https?:\/\/.+\]\(https?:\/\/.+\)$/.test(line)) continue
    if (/^\[[0-9]+\]/.test(line)) continue
    const cleaned = cleanRecoveredPrompt(line)
    if (cleaned.length >= 40) return cleaned
  }
  return `Analyze imported share report from ${args.url}`
}

const extractImportedShareHeadingLines = (importedText: string, maxCount = 6): string[] => {
  return uniqueText(
    stripLeadingFrontmatter(importedText)
      .split('\n')
      .map(line => {
        const match = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line)
        return match?.[1] ? clampText(match[1], 140) : ''
      })
      .filter(Boolean),
  ).slice(0, maxCount)
}

const extractImportedShareReferenceLines = (importedText: string, maxCount = 8): string[] => {
  return uniqueText(
    stripLeadingFrontmatter(importedText)
      .split('\n')
      .map(line => String(line || '').trim())
      .filter(line => /^\[[0-9]+\]/.test(line) || /^-\s+\[[0-9]+\]/.test(line))
      .map(line => clampText(line.replace(/^-+\s*/, ''), 220))
      .filter(Boolean),
  ).slice(0, maxCount)
}

const extractImportedShareNarrativeLines = (importedText: string, maxCount = 8): string[] => {
  return uniqueText(
    stripLeadingFrontmatter(importedText)
      .split('\n')
      .map(line => String(line || '').trim())
      .filter(line => line && !/^#{1,6}\s+/.test(line) && !/^\[https?:\/\/.+\]\(https?:\/\/.+\)$/.test(line) && !/^\[[0-9]+\]/.test(line))
      .map(line => cleanRecoveredPrompt(line))
      .map(line => clampText(line, 220))
      .filter(line => line.length >= 30),
  ).slice(0, maxCount)
}

const extractImportedShareSourceLinks = (args: { url: string; importedText: string }): string[] => {
  const out = [args.url]
  const body = stripLeadingFrontmatter(args.importedText)
  const urlMatches = body.match(/https?:\/\/[^\s)>\]]+/g) || []
  return uniqueText([...out, ...urlMatches]).slice(0, 12)
}

export const persistImportedShareUrlArtifacts = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedText: string
  importedWorkspacePath: string
  rootFolderPath?: string
}): Promise<null | {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath: string
}> => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  const {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  } = resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
  })
  const importedText = String(args.importedText || '').trimEnd() + '\n'
  const importedWorkspacePath = normalizeWorkspacePath(args.importedWorkspacePath)
  const recoveredPrompt = extractImportedSharePrompt({ url, importedText })
  const headingLines = extractImportedShareHeadingLines(importedText)
  const referenceLines = extractImportedShareReferenceLines(importedText)
  const narrativeLines = extractImportedShareNarrativeLines(importedText)
  const sourceLinks = extractImportedShareSourceLinks({ url, importedText })
  const queryRelevanceOverride = buildImportedShareQueryRelevanceOverride({
    recoveredPrompt,
    headingLines,
    referenceLines,
    narrativeLines,
  })
  const requestText = recoveredPrompt
  const reasoningSteps = [
    `fetch_url: ${url}`,
    `search: ${recoveredPrompt}`,
    ...headingLines.slice(0, 3).map(line => `search: ${line}`),
    `Canonical share token: ${exportToken}`,
    `Imported file name: ${args.importedName}`,
    `Imported workspace path: ${importedWorkspacePath}`,
    `run_code: Import URL share artifact export`,
    `tool_call: writeWorkspaceFileTextEnsuringFile -> ${exportMarkdownPath}`,
    `tool_call: writeWorkspaceFileTextEnsuringFile -> ${exportThinkingPath}`,
  ]
  const thinkingText = buildShareThinkingArtifactDocument({
    artifact: {
      url,
      exportToken,
      exportMarkdownPath,
      workspacePath: importedWorkspacePath,
      fileName: args.importedName,
    },
    bundle: {
      sessionId: 'import-url',
      streamLogPath: null,
    },
    timestampMs: Date.now(),
    traceId: `import-url:${exportToken}`,
    providerSummary: 'Import URL',
    modelId: null,
    workspacePath: importedWorkspacePath,
    requestText,
    rawAssistantText: importedText,
    workspaceAssistantText: importedText,
    usageSummary: null,
    finishReason: 'imported',
    reasoningSteps,
    rawSseEvents: [],
    status: 'ok',
    observedUrls: [url],
    reportDocuments: [],
    promptText: recoveredPrompt,
    queryText: recoveredPrompt,
    summaryText: 'Execution trace summary derived from the imported share prompt, recovered report content, and canonical Import URL artifact export.',
    preferredTrajectoryLines: uniqueText([
      'Recognized the imported URL as a dereferenceable share artifact.',
      `Recovered the share prompt: ${recoveredPrompt}`,
      ...(headingLines.length > 0 ? [`Workspace headings: ${headingLines.join(' | ')}`] : []),
    ]).slice(0, 10),
    preferredThinkingProcessLines: uniqueText([
      `Recovered prompt: ${recoveredPrompt}`,
      `Canonical share token: ${exportToken}`,
      `Imported file name: ${args.importedName}`,
      `Imported workspace path: ${importedWorkspacePath}`,
      ...(referenceLines.length > 0 ? [`Reference corpus: ${referenceLines.slice(0, 3).join(' | ')}`] : []),
    ]).slice(0, 10),
    preferredSearchLines: uniqueText([
      `search: ${recoveredPrompt}`,
      ...headingLines.slice(0, 3).map(line => `search: ${line}`),
    ]).slice(0, 10),
    preferredRunCodeLines: uniqueText([
      'run_code: Import URL share artifact export',
      `tool_call: writeWorkspaceFileTextEnsuringFile -> ${exportMarkdownPath}`,
      `tool_call: writeWorkspaceFileTextEnsuringFile -> ${exportThinkingPath}`,
    ]),
    preferredWorkspaceOutputLines: uniqueText([
      ...narrativeLines.slice(0, 5),
      ...headingLines.slice(0, 3).map(line => `Heading: ${line}`),
    ]).slice(0, 10),
    preferredStreamAlignedOutputLines: uniqueText([
      ...narrativeLines.slice(0, 4),
      ...headingLines.slice(0, 3).map(line => `Heading: ${line}`),
      ...referenceLines.slice(0, 3),
    ]).slice(0, 10),
    preferredSourceLinks: sourceLinks,
    preferredRelatedArtifactLines: uniqueText([
      `- Canonical Share Markdown: [${exportToken}.md](${exportMarkdownPath})`,
      `- Thinking Trace: [${exportToken}-thinking.md](${exportThinkingPath})`,
    ]),
    queryRelevanceOverride,
  })
  if (importedWorkspacePath !== exportMarkdownPath) {
    await writeWorkspaceFileTextEnsuringFile({
      fs: args.fs,
      path: exportMarkdownPath,
      text: importedText,
    })
  }
  await writeWorkspaceFileTextEnsuringFile({
    fs: args.fs,
    path: exportThinkingPath,
    text: thinkingText,
  })
  await ensureChatWorkspaceMirrorFolder(exportFolderPath)
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportMarkdownPath,
    text: importedText,
  })
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportThinkingPath,
    text: thinkingText,
  })
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  }
}

export const resolveImportedShareUrlPrimaryWorkspacePath = (args: {
  url: string
  importedName: string
  rootFolderPath?: string
}): string | null => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  return resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
  }).exportMarkdownPath
}
