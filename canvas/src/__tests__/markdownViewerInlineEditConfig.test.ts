import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownViewerInlineEditConfigSupportsImagesTasksHrTable = () => {
  const root = process.cwd()

  const blockPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownBlockContainer.tsx')
  const blockText = readUtf8(blockPath)
  if (!blockText.includes('includeImages: true')) {
    throw new Error('expected html→md conversion to include images (includeImages: true)')
  }
  if (!blockText.includes('taskPrefixMatch')) {
    throw new Error('expected task list prefix preservation logic in buildReplacementLinesFromDraft')
  }
  if (!blockText.includes('[&_code]:align-baseline')) {
    throw new Error('expected inline code to align with surrounding text baseline in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:leading-[var(--kg-inline-code-line-height,inherit)]')) {
    throw new Error('expected inline code to inherit surrounding line-height via css var in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:text-[length:var(--kg-inline-code-font-size,inherit)]')) {
    throw new Error('expected inline code to inherit surrounding font-size via css var in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:ring-1') || !blockText.includes('[&_code]:ring-inset')) {
    throw new Error('expected inline code to use ring styling to avoid border layout mutation in html edit surfaces')
  }
  if (blockText.includes("'[_&code]:border'")) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (blockText.includes('[&_code]:border-[color:var(--kg-code-border)]')) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (!blockText.includes('[&_code]:py-0')) {
    throw new Error('expected inline code to avoid vertical padding in html edit surfaces to reduce line-box mutation')
  }
  if (blockText.includes('[&_code]:py-0.5')) {
    throw new Error('expected html edit surfaces to avoid inline-code vertical padding that mutates spacing')
  }
  if (blockText.includes('[&_code]:text-sm')) {
    throw new Error('expected html edit surfaces to avoid hardcoded inline-code text size mutation')
  }

  const rendererPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownTokenRenderer.tsx')
  const rendererText = readUtf8(rendererPath)
  if (!rendererText.includes("case 'hr':") || !rendererText.includes('editPresentation="html"')) {
    throw new Error('expected hr blocks to be editable via MarkdownBlockContainer html presentation')
  }

  const inlinePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownInlineRenderer.tsx')
  const inlineText = readUtf8(inlinePath)
  if (!inlineText.includes('ring-[color:var(--kg-code-border)]') || !inlineText.includes('bg-[color:var(--kg-code-bg)]')) {
    throw new Error('expected read inline code to reuse css-var-backed code surface styling for view/edit parity')
  }
  if (!inlineText.includes('px-1.5 py-0 rounded')) {
    throw new Error('expected read inline code to match edit surface padding contract')
  }
  if (!inlineText.includes('text-[length:var(--kg-inline-code-font-size,inherit)]')) {
    throw new Error('expected read inline code to match edit surface font-size contract via css var')
  }
  if (!inlineText.includes('leading-[var(--kg-inline-code-line-height,inherit)]')) {
    throw new Error('expected read inline code to match edit surface line-height contract via css var')
  }
  if (inlineText.includes('py-0.5') || inlineText.includes('text-sm')) {
    throw new Error('expected read inline code to avoid hardcoded spacing/size that would break parity')
  }

  const tablePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownTableBlock.tsx')
  const tableText = readUtf8(tablePath)
  if (!tableText.includes('editPresentation="html"')) {
    throw new Error('expected table blocks to be editable via MarkdownBlockContainer html presentation')
  }

  const codePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx')
  const codeText = readUtf8(codePath)
  if (!codeText.includes('editDisableRichUi')) {
    throw new Error('expected code blocks to disable rich inline-edit UI')
  }
  if (!codeText.includes('editLineRange')) {
    throw new Error('expected code blocks to compute an inner editLineRange for fenced code')
  }
  if (!codeText.includes('editStaticChildren')) {
    throw new Error('expected code blocks to preserve header layout during inline edit (editStaticChildren)')
  }
  if (!codeText.includes('editTypographyMode="none"')) {
    throw new Error('expected code blocks to opt out of inherited typography to preserve monospace')
  }
  if (!codeText.includes('editPreserveWhitespace')) {
    throw new Error('expected code blocks to preserve indentation whitespace during inline edit')
  }
  if (!codeText.includes("'p-4'")) {
    throw new Error('expected code block inline editor to reuse p-4 spacing for edit-as-is surface parity')
  }
  if (codeText.includes('min-h-[96px]')) {
    throw new Error('expected code block inline editor to avoid hardcoded min height that changes layout')
  }
  if (!codeText.includes('w-full m-0 whitespace-pre outline-none bg-transparent overflow-auto')) {
    throw new Error('expected code block inline editor root to reset margins and preserve edit-as-is spacing')
  }

  const listPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownListBlock.tsx')
  const listText = readUtf8(listPath)
  if (!listText.includes('listClass')) {
    throw new Error('expected list renderer to keep ordered/unordered marker class handling')
  }
  if (!listText.includes('editPresentation="html"')) {
    throw new Error('expected list inline editor to use html presentation for wysiwyg-ish editing')
  }
  if (!listText.includes('editHtmlRender="block"')) {
    throw new Error('expected list inline editor to use block html rendering')
  }
  if (!listText.includes('editHtmlDisableDefaultBlockFlow')) {
    throw new Error('expected list inline editor to disable default block-flow classes')
  }
  if (!listText.includes('editLineRange={editLineRange || undefined}')) {
    throw new Error('expected list inline editor to trim editable line range to non-empty list lines')
  }
  if (!listText.includes("'block w-full m-0 whitespace-pre-wrap break-words outline-none bg-transparent'")) {
    throw new Error('expected list inline editor root to reset margins and keep edit-as-is spacing')
  }
  if (!listText.includes('[&_ol]:list-decimal') || !listText.includes('[&_ul]:list-disc')) {
    throw new Error('expected list inline editor to enforce ordered/unordered marker visibility on nested list roots')
  }
  if (!listText.includes('editTrimEmptyBlockEdges')) {
    throw new Error('expected list inline editor to trim empty edge rows during html list editing')
  }
  if (!listText.includes('editEnforceSingleListRoot')) {
    throw new Error('expected list inline editor to enforce a single list root')
  }
  if (!listText.includes('editListMode={list.ordered ? \'ordered\' : \'unordered\'}')) {
    throw new Error('expected list inline editor to provide explicit ordered/unordered mode')
  }
}
