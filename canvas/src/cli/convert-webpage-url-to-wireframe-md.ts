import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { runWebpageConvert, buildWireframeMarkdown, buildWireframeEnhancedMarkdown, clampInt } from '@/lib/websites/server/websiteImportCore'
import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { extractWireframeMockupAndTailFromMarkdownDoc } from '@/lib/markdown/wireframeAscii'

type Args = {
  url: string
  out: string
  detail: 'compact' | 'standard' | 'detailed'
  includeImages: boolean
  pythonBin: string
  enhanced: boolean
}

function parseArgs(argv: string[]): Args {
  const read = (key: string): string => {
    const idx = argv.findIndex(a => a === key)
    if (idx < 0) return ''
    return String(argv[idx + 1] || '').trim()
  }

  const url = read('--url')
  const out = read('--out')
  const detailRaw = read('--detail')
  const detail: Args['detail'] =
    detailRaw === 'compact' ? 'compact' : detailRaw === 'detailed' ? 'detailed' : 'standard'
  const pythonBin = read('--python') || String(process.env.KG_PYTHON_BIN || 'python3')
  const includeImages = read('--no-images') ? false : true
  const enhanced = argv.includes('--enhanced')

  if (!url) throw new Error('Missing --url')
  if (!out) throw new Error('Missing --out')

  return { url, out, detail, includeImages, pythonBin, enhanced }
}

function resolveWorkspaceRoot(cwd: string): string {
  const maxDepth = 6
  for (let i = 0; i <= maxDepth; i += 1) {
    const candidate = path.resolve(cwd, Array.from({ length: i }).map(() => '..').join(path.sep) || '.')
    const hasKnowgrph = fsSync.existsSync(path.join(candidate, 'knowgrph'))
    const hasSandbox = fsSync.existsSync(path.join(candidate, 'sandbox'))
    if (hasKnowgrph && hasSandbox) return candidate
  }
  return path.resolve(cwd, '../../..')
}

function safeOutPath(monorepoRoot: string, outRaw: string): string {
  const outAbs = path.isAbsolute(outRaw) ? outRaw : path.resolve(process.cwd(), outRaw)
  const root = path.resolve(monorepoRoot)
  const candidate = path.resolve(outAbs)
  if (!candidate.startsWith(root + path.sep) && candidate !== root) {
    throw new Error('Output path must be inside the monorepo root')
  }
  return candidate
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const repoRoot = path.resolve(process.cwd(), '..')
  const workspaceRoot = resolveWorkspaceRoot(process.cwd())
  const outAbs = safeOutPath(workspaceRoot, args.out)

  const converted = await runWebpageConvert({
    repoRoot,
    pythonBin: args.pythonBin,
    url: args.url,
    includeImages: args.includeImages,
  })

  if (converted.ok !== true) throw new Error(converted.error)

  const outDoc = (() => {
    if (args.enhanced) {
      const enhanced = buildWireframeEnhancedMarkdown(converted.markdown, args.url, { title: converted.title || undefined })
      return upsertWebpageFrontmatterMeta(enhanced, { url: args.url, view: 'wireframe-enhanced' })
    }

    const wireframe = buildWireframeMarkdown(converted.markdown, args.url, {
      detailLevel: args.detail,
      title: converted.title,
    })
    const { mockup, tail } = extractWireframeMockupAndTailFromMarkdownDoc(wireframe)

    const host = (() => {
      try {
        return new URL(args.url).host
      } catch {
        return args.url
      }
    })()

    const docParts: string[] = []
    docParts.push(`# ASCII Wireframe: ${host}`)
    docParts.push('')
    docParts.push('```text kg-wireframe')
    docParts.push(String(mockup || '').trimEnd())
    docParts.push('```')

    if (String(tail || '').trim()) {
      docParts.push('')
      docParts.push('## Document Structure')
      docParts.push('')
      docParts.push('```text')
      docParts.push(String(tail || '').trimEnd())
      docParts.push('```')
    }

    return upsertWebpageFrontmatterMeta(docParts.join('\n') + '\n', { url: args.url, view: 'wireframe' })
  })()

  const maxBytes = clampInt(process.env.KG_WEBPAGE_WIREFRAME_OUT_MAX_BYTES, 2_000_000, 50_000, 10_000_000)
  if (Buffer.byteLength(outDoc, 'utf8') > maxBytes) throw new Error('Output exceeds max bytes')

  await fs.mkdir(path.dirname(outAbs), { recursive: true })
  await fs.writeFile(outAbs, outDoc, 'utf8')
}

main().catch(err => {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || err) : String(err)
  process.stderr.write(`${msg}\n`)
  process.exit(1)
})
