import type { FeishuBaseSourceAdapterInput } from '@/features/source-files/feishuBaseSourceAdapter'

export type FeishuBaseSourceImportRequest = {
  fileId: string | null
  snapshot: FeishuBaseSourceAdapterInput
}

export type FeishuBaseSourceImportResult =
  | {
      ok: true
      fileId: string
      name: string
      warnings: string[]
    }
  | {
      ok: false
      error: string
      warnings: string[]
    }
