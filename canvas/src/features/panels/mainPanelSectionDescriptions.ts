import { parseMarkdownTableRows } from '@/features/panels/mainPanelMarkdownTable'

export const MAIN_PANEL_SECTION_DESCRIPTIONS_DOC_PATH = 'docs/documents/knowgrph-mainpanel-section-descriptions.md'

export type MainPanelSectionDescription = Readonly<{
  key: string
  value: string
  highlights: readonly string[]
}>

const splitHighlights = (raw: string): string[] => String(raw || '')
  .split(';')
  .map(value => value.trim())
  .filter(Boolean)

export function parseMainPanelSectionDescriptionRows(markdown: string): MainPanelSectionDescription[] {
  return parseMarkdownTableRows(markdown)
    .map(row => ({
      key: String(row.key || '').trim(),
      value: String(row.value || '').trim(),
      highlights: splitHighlights(row.highlights || ''),
    }))
    .filter(row => row.key.length > 0 && row.value.length > 0)
}

export function toMainPanelSectionDescriptionMap(rows: readonly MainPanelSectionDescription[]): Record<string, MainPanelSectionDescription> {
  return Object.fromEntries(rows.map(row => [row.key, row])) as Record<string, MainPanelSectionDescription>
}

async function readMainPanelSectionDescriptionsMarkdownFromNode(): Promise<string> {
  if (typeof process === 'undefined' || typeof process.versions?.node !== 'string') return ''
  try {
    const fs = await import(/* @vite-ignore */ 'node:fs/promises') as typeof import('node:fs/promises')
    return await fs.readFile(new URL('../../../../docs/documents/knowgrph-mainpanel-section-descriptions.md', import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

export async function loadMainPanelSectionDescriptions(): Promise<Record<string, MainPanelSectionDescription>> {
  try {
    const markdownModule = await import('../../../../docs/documents/knowgrph-mainpanel-section-descriptions.md?raw') as { default?: string }
    const markdown = markdownModule.default || ''
    if (markdown.trim()) return toMainPanelSectionDescriptionMap(parseMainPanelSectionDescriptionRows(markdown))
  } catch {
    void 0
  }
  const nodeMarkdown = await readMainPanelSectionDescriptionsMarkdownFromNode()
  return nodeMarkdown.trim()
    ? toMainPanelSectionDescriptionMap(parseMainPanelSectionDescriptionRows(nodeMarkdown))
    : {}
}
