import {
  MARKDOWN_EXPLORER_SECTION_MIN_HEIGHT_PX,
  resolveMarkdownExplorerSectionResize,
} from '@/features/markdown-workspace/markdownExplorerSectionResize'

export function testMarkdownExplorerSectionResizeKeepsAdjacentSectionOwnership() {
  const start = {
    sourceFiles: 480,
    toc: 120,
    backlinks: 80,
  }

  const sourceToToc = resolveMarkdownExplorerSectionResize({
    boundary: 'sourceFiles-toc',
    startHeightsPx: start,
    deltaY: 50,
  })
  if (sourceToToc.sourceFiles !== 530 || sourceToToc.toc !== 70 || sourceToToc.backlinks !== 80) {
    throw new Error(`expected Source Files / TOC resize to transfer height only across that boundary, got ${JSON.stringify(sourceToToc)}`)
  }

  const tocToBacklinks = resolveMarkdownExplorerSectionResize({
    boundary: 'toc-backlinks',
    startHeightsPx: start,
    deltaY: -90,
  })
  if (tocToBacklinks.sourceFiles !== 480 || tocToBacklinks.toc !== MARKDOWN_EXPLORER_SECTION_MIN_HEIGHT_PX || tocToBacklinks.backlinks !== 144) {
    throw new Error(`expected TOC / Backlinks resize to clamp only that boundary, got ${JSON.stringify(tocToBacklinks)}`)
  }
}
