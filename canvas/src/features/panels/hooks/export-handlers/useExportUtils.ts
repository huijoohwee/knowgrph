import { useCallback } from 'react'

export type WorkflowExportStatusDeps = {
  markExported: () => void
  setTransientExportStatus: (msg: string) => void
}

export function useExportUtils({ markExported, setTransientExportStatus }: WorkflowExportStatusDeps) {
  const runParserExport = useCallback(
    (handler: (() => void) | undefined, meta: { missing: string; ok: string; failed: string }) => {
      try {
        if (!handler) {
          setTransientExportStatus(meta.missing)
          return
        }
        handler()
        markExported()
        setTransientExportStatus(meta.ok)
      } catch {
        setTransientExportStatus(meta.failed)
      }
    },
    [markExported, setTransientExportStatus],
  )

  const runCopyToClipboard = useCallback(
    <T>(data: T | null, run: (value: T) => Promise<boolean>, meta: { missing: string; ok: string; failed: string }) => {
      if (!data) {
        setTransientExportStatus(meta.missing)
        return
      }
      void (async () => {
        try {
          const ok = await run(data)
          setTransientExportStatus(ok ? meta.ok : meta.failed)
        } catch {
          setTransientExportStatus(meta.failed)
        }
      })()
    },
    [setTransientExportStatus],
  )

  return { runParserExport, runCopyToClipboard }
}
