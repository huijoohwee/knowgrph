import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { buildGitHubRawFileUrl, fetchGitHubRepoMeta, listGitHubRepoTreeFiles, parseGitHubRepoUrl, resolveGitHubDefaultBranch } from '@/features/markdown-workspace/githubRepoApi'
import { buildGitHubRepoSitemapMarkdown, buildGitHubRepoUserJourneyMarkdown } from '@/features/markdown-workspace/githubRepoDocs'

const argValue = (name: string): string | null => {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return null
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return null
  return next
}

const toSlug = (raw: string) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'repo'

async function main() {
  const url = argValue('--url') || argValue('-u')
  if (!url) throw new Error('Missing required --url')
  const outDir = argValue('--outDir') || argValue('-o') || process.cwd()
  const maxFiles = Number(argValue('--maxFiles') || '0')
  const maxFilesBound = Number.isFinite(maxFiles) && maxFiles > 0 ? Math.floor(maxFiles) : 1

  const repoRef = parseGitHubRepoUrl(url)
  if (!repoRef) throw new Error(`Unsupported GitHub repo URL: ${url}`)
  const ref = repoRef.ref || (await resolveGitHubDefaultBranch({ owner: repoRef.owner, repo: repoRef.repo }))

  const tree = await listGitHubRepoTreeFiles({ owner: repoRef.owner, repo: repoRef.repo, ref, subdirPath: repoRef.subdirPath, maxFiles: maxFilesBound })
  const repoMeta = await fetchGitHubRepoMeta({ owner: repoRef.owner, repo: repoRef.repo })

  const readmeUrl = buildGitHubRawFileUrl({ owner: repoRef.owner, repo: repoRef.repo, ref, relPath: 'README.md' })
  const readmeFetched = await fetchRemoteTextDetailed(readmeUrl, { preferProxy: true, preflightHead: true, maxBytes: 500_000 })
  const readmeMarkdown = readmeFetched.ok ? readmeFetched.text : ''

  const sitemapText = await buildGitHubRepoSitemapMarkdown({
    owner: repoRef.owner,
    repo: repoRef.repo,
    ref,
    repoMeta,
    allTreePaths: tree.allPaths,
    readmeMarkdown,
  })
  const journeyText = buildGitHubRepoUserJourneyMarkdown({
    owner: repoRef.owner,
    repo: repoRef.repo,
    repoMeta,
    ref,
    allTreePaths: tree.allPaths,
    readmeMarkdown,
  })

  const slug = toSlug(repoRef.repo)
  const sitemapName = argValue('--sitemapName') || `sitemap-${slug}.md`
  const journeyName = argValue('--journeyName') || `user-journey-flow-${slug}.md`

  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, sitemapName), sitemapText, 'utf8')
  await writeFile(path.join(outDir, journeyName), journeyText, 'utf8')

  process.stdout.write(`Wrote ${sitemapName} and ${journeyName} to ${outDir}\n`)
}

void main()

