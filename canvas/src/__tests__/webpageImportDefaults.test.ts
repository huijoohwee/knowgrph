import { useGraphStore } from '@/hooks/useGraphStore'
import { parseWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'

export function testWebpageImportDefaultsPreferHtmlAndAllowScripts() {
  const s = useGraphStore.getState()
  if (s.webpageImportView !== 'html') throw new Error(`expected webpageImportView default to be html, got: ${String(s.webpageImportView)}`)
  if (s.webpageViewerScriptPolicy !== 'allow') {
    throw new Error(`expected webpageViewerScriptPolicy default to be allow, got: ${String(s.webpageViewerScriptPolicy)}`)
  }
  if (s.websiteImportGenerateWebpageArtifactDocs !== true) throw new Error('expected website imports to materialize content docs by default')
  if (s.websiteImportMaxPages < 100) throw new Error(`expected website import default page budget >=100, got: ${String(s.websiteImportMaxPages)}`)
}

export function testWebpageFrontmatterDefaultsToHtmlViewWhenMissingViewKey() {
  const text = ['---', 'kgWebpageUrl: "https://example.invalid/"', '---', '', '# Title'].join('\n')
  const fm = parseWebpageFrontmatterMeta(text)
  if (!fm) throw new Error('expected webpage frontmatter meta')
  if (fm.view !== 'html') throw new Error(`expected view=html when kgWebpageView missing, got: ${String(fm.view)}`)
}
