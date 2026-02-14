import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { clampInt, fetchTextWithLimit, normalizeUrl, runWebpageConvert, type WebpageConvertPayload } from './websiteImportCore'

const writeFileAtomic = async (filePath: string, text: string): Promise<void> => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `${path.basename(filePath)}.${randomUUID()}.tmp`)
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, filePath)
}

export async function convertWebpageToMarkdownWithHtmlArtifact(args: {
  repoRoot: string
  pythonBin: string
  url: string
  includeImages: boolean
  htmlPathAbs: string
}): Promise<WebpageConvertPayload> {
  const normalized = normalizeUrl(args.url)
  if (!normalized) return { ok: false, error: 'Invalid url' }
  const staticFetchTimeoutMs = clampInt(process.env.KG_WEBPAGE_STATIC_FETCH_TIMEOUT_MS, 40_000, 5_000, 180_000)
  const staticFetchMaxBytes = clampInt(process.env.KG_WEBPAGE_STATIC_FETCH_MAX_BYTES, 8 * 1024 * 1024, 200_000, 30 * 1024 * 1024)

  const convertFromHtmlPath = async (): Promise<WebpageConvertPayload> => {
    return await runWebpageConvert({
      repoRoot: args.repoRoot,
      pythonBin: args.pythonBin,
      url: normalized,
      includeImages: args.includeImages,
      htmlPath: args.htmlPathAbs,
    })
  }

  const doStatic = async (): Promise<WebpageConvertPayload> => {
    const rawHtmlRes = await fetchTextWithLimit(normalized, { timeoutMs: staticFetchTimeoutMs, maxBytes: staticFetchMaxBytes, accept: 'text/html,*/*;q=0.9' })
    if (rawHtmlRes.ok !== true) return { ok: false, error: rawHtmlRes.error }
    await writeFileAtomic(args.htmlPathAbs, rawHtmlRes.text)
    return await convertFromHtmlPath()
  }

  return await doStatic()
}
