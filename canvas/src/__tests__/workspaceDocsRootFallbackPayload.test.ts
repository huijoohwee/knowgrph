import { isAcceptableWorkspaceDocsRootFallbackPayload } from '@/features/source-files/sourceFilesRuntimeActive'

const VITE_DEV_INDEX_HTML = [
  '<!doctype html><html lang="en">',
  '<script type="module">import { injectIntoGlobalHook } from "/@react-refresh";</script>',
  '<script type="module" src="/@vite/client"></script>',
  '<main id="root"></main><script type="module" src="/src/main.tsx?t=123"></script>',
  '</html>',
].join('\n')

export function testWorkspaceDocsRootFallbackRejectsViteAppShell() {
  if (isAcceptableWorkspaceDocsRootFallbackPayload(VITE_DEV_INDEX_HTML)) {
    throw new Error('expected a Vite SPA fallback response to be rejected as workspace document text')
  }
}

export function testWorkspaceDocsRootFallbackAcceptsMarkdown() {
  if (!isAcceptableWorkspaceDocsRootFallbackPayload('# Workspace document')) {
    throw new Error('expected authored Markdown from the configured docs root to remain accepted')
  }
}

export function testWorkspaceDocsRootFallbackRejectsBlankText() {
  if (isAcceptableWorkspaceDocsRootFallbackPayload('  \n')) {
    throw new Error('expected an empty source file to remain empty instead of becoming fallback content')
  }
}
