import { extractYamlFrontmatterBlock, readYamlFrontmatterValue } from '@/lib/markdown/frontmatter'

export const looksLikeHydrateDisabledSourceLinkStub = (rawText: string): boolean => {
  const block = extractYamlFrontmatterBlock(rawText)
  return !!block
    && readYamlFrontmatterValue(block.rawBlock, 'kgWebpageHydrate') === 'false'
    && /^\[[^\]\n]*\]\(https?:\/\/[^\s)]+\)\s*$/i.test(String(block.bodyText || '').trim())
}
