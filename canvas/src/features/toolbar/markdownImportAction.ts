import { UI_COPY } from '@/lib/config'
import { pickTextFilesWithExtensions } from '@/lib/graph/file'
import { parseHtmlToMarkdownAllTextAsync } from '@/features/parsers/html-parser'
import { coerceHttpUrl } from '@/lib/url'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createId } from '@/lib/id'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { ensureMarkdownFileName, upsertWorkspaceTextDocument } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { applyImportedMarkdownToStore } from '@/features/toolbar/importSideEffects'
import { hashText } from '@/features/parsers/hash'
import { buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import {
  fetchRemoteMarkdownText,
  promptForUrl,
  deriveMarkdownNameFromUrl,
} from './ingestUtils'

export type MarkdownImportType = 'url' | 'local'

export async function performMarkdownImport(type: MarkdownImportType, providedUrl?: string) {
  try {
    const pickedFiles = await (async (): Promise<Array<{ name: string; text: string; displayName?: string; sourceUrl?: string }>> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.markdownImportUrlPrompt) || ''
        })()
        if (!rawUrl) return []
        const res = await fetchRemoteMarkdownText(rawUrl)
        return res ? [{ ...res, sourceUrl: rawUrl }] : []
      }
      if (type === 'local') {
        const files = await pickTextFilesWithExtensions(['.md', '.markdown', '.mmd'])
        return files.map(f => ({
          name: f.name,
          text: f.text,
          displayName: f.name,
        }))
      }
      return []
    })()

    if (!pickedFiles || pickedFiles.length === 0) return

    const store = useGraphStore.getState()
    pickedFiles.forEach(f => {
      store.addSourceFile(buildSourceFileRecord({
        id: createId('sf'),
        name: f.displayName || f.name,
        text: f.text,
        enabled: true,
        source: f.sourceUrl ? { kind: 'url', url: f.sourceUrl } : { kind: 'local', path: f.name },
      }))
    })

    const first = pickedFiles[0]

    const text = await (async () => {
      const raw = String(first.text || '')
      const trimmed = raw.trim().toLowerCase()
      const looksHtml =
        trimmed.startsWith('<!doctype html') ||
        trimmed.startsWith('<html') ||
        (trimmed.includes('<html') && trimmed.includes('</html>'))
      if (!looksHtml) return raw
      const baseUrl = coerceHttpUrl(first.name) || undefined
      const toastId = `import:markdown:html:convert:${hashText(String(baseUrl || first.name || 'html'))}`
      try {
        useGraphStore.getState().upsertUiToast({
          id: toastId,
          kind: 'neutral',
          message: 'Converting HTML…',
          ttlMs: null,
          dismissible: false,
          log: false,
        })
      } catch {
        void 0
      }
      const markdown = await parseHtmlToMarkdownAllTextAsync(raw, baseUrl, {
        onProgress: (_phase, p) => {
          try {
            useGraphStore.getState().upsertUiToast({
              id: toastId,
              kind: 'neutral',
              message: `Converting HTML… ${p}%`,
              ttlMs: null,
              dismissible: false,
              log: false,
            })
          } catch {
            void 0
          }
        },
      })
      try {
        useGraphStore.getState().upsertUiToast({
          id: toastId,
          kind: 'success',
          message: 'HTML converted',
          ttlMs: 2200,
          dismissible: true,
          log: false,
        })
      } catch {
        void 0
      }
      return markdown
    })()

    const nameForParse = first.displayName || first.name
    await runImportFlow({
      nameForParse,
      textForParse: text,
      openWorkspaceViewMode: 'editor',
      onSuccess: (res) => {
        if (!res.input || !res.input.text.trim()) return
        const rawSourceName = String(first.name || '')
        const isHttp = /^https?:\/\//i.test(rawSourceName)
        const name = isHttp ? deriveMarkdownNameFromUrl(rawSourceName) : ensureMarkdownFileName(res.input.name || first.displayName || first.name)

        applyImportedMarkdownToStore({
          name,
          text: res.input.text,
          sourceUrl: isHttp ? rawSourceName : null,
          recent: isHttp
            ? { name, url: rawSourceName, type: 'url' }
            : { name, path: type === 'local' ? first.name : undefined, type: 'markdown' },
          curationView: 'markdown',
        })

        void (async () => {
          try {
            const fs = await getWorkspaceFs()
            await fs.ensureSeed()
            const path = await upsertWorkspaceTextDocument({ fs, parentPath: WORKSPACE_ROOT_PATH, name, text: res.input.text })
            setWorkspaceEntrySource(path, isHttp ? { kind: 'url', url: rawSourceName } : { kind: 'local', originalName: first.name })
            useMarkdownExplorerStore.getState().setActivePath(path)
          } catch {
            void 0
          }
        })()
      },
    })
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
