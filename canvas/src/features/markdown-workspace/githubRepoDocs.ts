import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { renderTemplateGalleryGridTwoRows } from '@/lib/websites/webpageMarkdownArtifactAscii'
import { buildGitHubRawFileUrl } from './githubRepoApi'
import type { GitHubRepoMeta } from './githubRepoTypes'
import { detectRepoKeyFiles, extractGitHubRoutesFromServerText } from './githubRepoHeuristics'
import { inferDecisionLogicNote, extractPythonStructuredOutline } from './githubRepoPythonOutline'
import { filterToLikelyFilePaths, renderRepoTreeAscii, renderTopLevelDirectoryTreeWithNotes } from './githubRepoTreeRender'
import { buildTemplateGridFromGroups, detectApiSupportLabel, detectSupportedPlatformsFromReadme, extractGpuTypesFromReadme, extractReadmeSectionBlockAny, extractRepoReadmeFeatureGroups, extractShortcutKeybinds, parseRequirements } from './githubRepoReadmeSignals'
import { serializeMarkdownPipeTable, type MarkdownPipeTableAlignment, type MarkdownPipeTableScalar } from '@/features/markdown/ui/markdownDataViewSerialize'

const appendMarkdownTable = (
  lines: string[],
  columns: readonly MarkdownPipeTableScalar[],
  rows: readonly (readonly MarkdownPipeTableScalar[])[],
  alignments?: readonly MarkdownPipeTableAlignment[],
): void => {
  lines.push(...serializeMarkdownPipeTable({ columns, rows, alignments }))
}
const formatK = (n: number) => {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n >= 100_000) return `${Math.round(n / 1000)}k`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}
const formatIsoDateMonthYear = (iso: string) => {
  const s = String(iso || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
export const buildGitHubRepoUserJourneyMarkdown = (args: {
  owner: string
  repo: string
  repoMeta: GitHubRepoMeta
  ref: string
  allTreePaths: string[]
  readmeMarkdown: string
}): string => {
  const rootName = String(args.repo || 'repo').replace(/\.git$/i, '') || 'repo'
  const repoUrl = `https://github.com/${args.owner}/${args.repo}`
  const desc = typeof args.repoMeta.description === 'string' ? args.repoMeta.description : ''
  const dateDisplay = new Date().toISOString().slice(0, 10)
  const readmeLower = String(args.readmeMarkdown || '').toLowerCase()

  const installModes = (() => {
    const modes: string[] = []
    if (readmeLower.includes('desktop application')) modes.push('Desktop Application')
    if (readmeLower.includes('windows portable')) modes.push('Windows Portable')
    if (readmeLower.includes('manual install')) modes.push('Manual Install')
    if (!modes.length) modes.push('Install')
    return modes
  })()

  const port = (() => {
    const m = String(args.readmeMarkdown || '').match(/localhost\s*[:]\s*(\d{2,5})/i)
    return m ? String(m[1] || '').trim() : ''
  })()

  const shortcuts = extractShortcutKeybinds(args.readmeMarkdown, 24)
  const groups = extractRepoReadmeFeatureGroups(args.readmeMarkdown)
  const primaryFeatureGroup = groups.find(g => /features|models|shortcuts/i.test(g.title)) || groups[0] || null
  const templateNames = buildTemplateGridFromGroups(groups)

  const hasApi = readmeLower.includes('api') || args.allTreePaths.some(p => p.toLowerCase().includes('api'))
  const hasCustomNodes = readmeLower.includes('custom nodes') || args.allTreePaths.some(p => p.toLowerCase().includes('custom_nodes'))
  const hasOffline = readmeLower.includes('offline')
  const hasQueue = readmeLower.includes('queue') || shortcuts.some(s => /queue/i.test(s.desc))
  const hasExamples = readmeLower.includes('examples') || readmeLower.includes('example workflows')

  const doc: string[] = []
  doc.push(`# ${rootName} User Journey Flow & UI Map`)
  doc.push(`## ${repoUrl}`)
  doc.push('')
  doc.push(`> **Document Purpose:** Comprehensive user journey mapping with ASCII flow diagrams, UI interactions, and code dependencies for ${rootName}${desc ? ` — ${desc}` : ''}.`)
  doc.push('')
  doc.push(`**Repository:** ${repoUrl}  `)
  doc.push(`**Analysis Date:** ${dateDisplay}`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 👥 User Personas')
  doc.push('')
  doc.push('### Persona 1: Beginner User')
  doc.push('- **Goal:** Get a first successful run')
  doc.push('- **Primary Path:** Use a default/example workflow')
  doc.push('')
  doc.push('### Persona 2: Power User')
  doc.push('- **Goal:** Build advanced multi-step workflows')
  doc.push('- **Primary Path:** Compose nodes/steps and iterate')
  doc.push('')
  doc.push('### Persona 3: Developer')
  doc.push('- **Goal:** Automate runs and extend capabilities')
  doc.push(`- **Primary Path:** ${hasApi ? 'API usage' : 'CLI/config'} + extensions`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🗺️ Master User Journey Overview')
  doc.push('')
  doc.push('```ascii')
  doc.push('┌─────────────────────────────────────────────────────────────────────────────┐')
  doc.push(`│${` ${rootName.toUpperCase()} USER JOURNEY MAP `.padEnd(77, ' ')}│`)
  doc.push('└─────────────────────────────────────────────────────────────────────────────┘')
  doc.push('')
  doc.push('                              ┌──────────────┐')
  doc.push('                              │  NEW USER    │')
  doc.push('                              │   ARRIVES    │')
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  if (installModes.length >= 3) {
    doc.push('                     ┌───────────────┼───────────────┐')
    doc.push('                     │               │               │')
    doc.push('              ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐')
    doc.push(`              │ ${installModes[0].toUpperCase().slice(0, 10).padEnd(12, ' ')}│ │ ${installModes[1].toUpperCase().slice(0, 10).padEnd(11, ' ')}│ │ ${installModes[2].toUpperCase().slice(0, 10).padEnd(11, ' ')}│`)
    doc.push('              └──────┬──────┘ └─────┬──────┘ └─────┬──────┘')
    doc.push('                     │               │               │')
    doc.push('                     └───────────────┼───────────────┘')
    doc.push('                                     │')
  }
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ FIRST LAUNCH │')
  doc.push(`                              │ ${port ? `localhost:${port}`.padEnd(12, ' ') : 'localhost'.padEnd(12, ' ')}│`)
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  if (hasExamples) {
    doc.push('                     ┌───────────────┼───────────────┐')
    doc.push('                     │               │               │')
    doc.push('              ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐')
    doc.push('              │ EXPLORE     │ │ LOAD       │ │ START      │')
    doc.push('              │ EMPTY       │ │ EXAMPLE    │ │ BLANK      │')
    doc.push('              └──────┬──────┘ └─────┬──────┘ └─────┬──────┘')
    doc.push('                     │               │               │')
    doc.push('                     └───────────────┼───────────────┘')
    doc.push('                                     │')
  }
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ BUILD FLOW   │')
  doc.push('                              │ Add Nodes    │')
  doc.push('                              │ Connect Wires│')
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ QUEUE / RUN  │')
  doc.push(`                              │ ${shortcuts.find(s => /enter/i.test(s.key) && /queue/i.test(s.desc))?.key || 'Ctrl+Enter'}       │`)
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ REVIEW OUTPUT│')
  doc.push('                              │ Iterate/Save │')
  doc.push('                              └──────────────┘')
  doc.push('```')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 📱 UI Layout & Interaction Map')
  doc.push('')
  doc.push('```ascii')
  doc.push('┌─────────────────────────────────────────────────────────────────────────────┐')
  doc.push(`│ ${rootName.toUpperCase().padEnd(32, ' ')} ${port ? `localhost:${port}`.padEnd(18, ' ') : ''.padEnd(18, ' ')}                          │`)
  doc.push('├─────────────────────────────────────────────────────────────────────────────┤')
  doc.push('│ ┌─────────────────────────────────────────────────────────────────────────┐ │')
  doc.push('│ │ TOP MENU BAR                                                            │ │')
  doc.push(`│ │ [Load] [Save] [Queue] [Settings] ${hasApi ? '[API]' : ''} [Help]                                 │ │`)
  doc.push('│ └─────────────────────────────────────────────────────────────────────────┘ │')
  doc.push('│ ┌───────────┬─────────────────────────────────────────────┬───────────────┐ │')
  doc.push('│ │ NODES     │ CANVAS AREA                                  │ SIDEBAR       │ │')
  doc.push('│ │ Search…   │ (Drag and drop nodes here)                   │ Queue/History │ │')
  doc.push('│ │ Categories│                                             │               │ │')
  doc.push('│ └───────────┴─────────────────────────────────────────────┴───────────────┘ │')
  doc.push('│ ┌─────────────────────────────────────────────────────────────────────────┐ │')
  doc.push(`│ │ STATUS: ${hasQueue ? 'Queue active' : 'Ready'} | ${hasOffline ? 'Offline-capable' : 'Network optional'} | ${hasCustomNodes ? 'Custom nodes' : 'Extensions'} │ │`)
  doc.push('│ └─────────────────────────────────────────────────────────────────────────┘ │')
  doc.push('└─────────────────────────────────────────────────────────────────────────────┘')
  doc.push('```')
  doc.push('')

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Journey 1: First-Time User')
  doc.push('')
  doc.push('```ascii')
  doc.push(`START: User opens ${rootName} for the first time`)
  doc.push('│')
  doc.push(`├─ STEP 1: Install (${installModes.join(' | ')})`)
  doc.push('│')
  doc.push(`├─ STEP 2: First launch (${port ? `http://localhost:${port}` : 'http://localhost:<port>'})`)
  doc.push('│')
  doc.push(`├─ STEP 3: Choose a starting point (${hasExamples ? 'example workflow or blank canvas' : 'blank canvas'})`)
  doc.push('│')
  doc.push('├─ STEP 4: Adjust parameters (prompts/settings)')
  doc.push('│')
  doc.push(`├─ STEP 5: Run (${shortcuts.find(s => /enter/i.test(s.key) && /queue/i.test(s.desc))?.key || 'Ctrl+Enter'} or click Queue)`) 
  doc.push('│')
  doc.push('└─ STEP 6: Review outputs, iterate, and save')
  doc.push('```')
  doc.push('')

  if (shortcuts.length) {
    doc.push('---')
    doc.push('')
    doc.push('## ⌨️ Keyboard Shortcuts (Extracted)')
    doc.push('')
    appendMarkdownTable(doc, ['Keybind', 'Explanation'], shortcuts.slice(0, 24).map(s => [s.key, s.desc]))
    doc.push('')
  }

  if (primaryFeatureGroup) {
    doc.push('---')
    doc.push('')
    doc.push(`## 📌 Key Capabilities Snapshot: ${primaryFeatureGroup.title}`)
    doc.push('')
    appendMarkdownTable(doc, ['Capability', 'Notes'], primaryFeatureGroup.items.slice(0, 16).map(it => [`**${it}**`, 'Feature']))
    doc.push('')
  }

  if (templateNames.length) {
    doc.push('---')
    doc.push('')
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderTemplateGalleryGridTwoRows(templateNames))
    doc.push('```')
    doc.push('')
  }

  return doc.join('\n')
}

export const buildGitHubRepoSitemapMarkdown = async (args: {
  owner: string
  repo: string
  ref: string
  repoMeta: GitHubRepoMeta
  allTreePaths: string[]
  readmeMarkdown: string
}): Promise<string> => {
  const fullName = typeof args.repoMeta.full_name === 'string' ? args.repoMeta.full_name : `${args.owner}/${args.repo}`
  const desc = typeof args.repoMeta.description === 'string' ? args.repoMeta.description : ''
  const licenseSpdx = (() => {
    const lic = args.repoMeta.license
    if (lic && typeof lic === 'object' && 'spdx_id' in lic) {
      const spdx = (lic as { spdx_id?: unknown }).spdx_id
      return typeof spdx === 'string' ? spdx : ''
    }
    return ''
  })()
  const stars = typeof args.repoMeta.stargazers_count === 'number' ? args.repoMeta.stargazers_count : Number(args.repoMeta.stargazers_count)
  const forks = typeof args.repoMeta.forks_count === 'number' ? args.repoMeta.forks_count : Number(args.repoMeta.forks_count)
  const updated = typeof args.repoMeta.updated_at === 'string' ? args.repoMeta.updated_at : ''
  const rootName = String(args.repo || 'repo').replace(/\.git$/i, '') || 'repo'

  const folderCount = (() => {
    const s = new Set<string>()
    for (const p of args.allTreePaths) {
      const parts = String(p || '').split('/').filter(Boolean)
      let cur = ''
      for (let i = 0; i < parts.length - 1; i += 1) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i]
        s.add(cur)
      }
    }
    return s.size
  })()

  const rootPy = args.allTreePaths.filter(p => /^[^/]+\.py$/i.test(p))
  const rootFiles = args.allTreePaths.filter(p => p && !p.includes('/') && !p.endsWith('/'))
  const readmeGroups = extractRepoReadmeFeatureGroups(args.readmeMarkdown)
  const templateNames = buildTemplateGridFromGroups(readmeGroups)
  const platforms = detectSupportedPlatformsFromReadme(args.readmeMarkdown)
  const gpuTypes = extractGpuTypesFromReadme(args.readmeMarkdown)
  const apiSupport = detectApiSupportLabel(args.readmeMarkdown, args.allTreePaths)
  const hasCustomNodes = args.allTreePaths.some(p => p.toLowerCase().includes('custom_nodes'))

  const doc: string[] = []
  doc.push(`# ${rootName} Repository Sitemap`)
  doc.push(`## https://github.com/${args.owner}/${args.repo}`)
  doc.push('')
  if (desc) doc.push(`> **Repository Overview:** ${desc}`)
  doc.push('')
  if (licenseSpdx) doc.push(`**License:** ${licenseSpdx}  `)
  if (Number.isFinite(stars)) doc.push(`**Stars:** ${formatK(stars)}  `)
  if (Number.isFinite(forks)) doc.push(`**Forks:** ${formatK(forks)}  `)
  const updatedDisplay = formatIsoDateMonthYear(updated)
  if (updatedDisplay) doc.push(`**Last Updated:** ${updatedDisplay}`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🔝 Header Navigation')
  doc.push('')
  appendMarkdownTable(doc, ['Area', 'Items', 'Notes'], [[
    '**Repository**',
    'Code, Issues, Pull requests, Actions, Projects, Wiki, Security, Insights',
    'Derived GitHub UI tabs',
  ]])
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🎯 Hero Section')
  doc.push('')
  appendMarkdownTable(doc, ['Element', 'Type', 'Value'], [
    ['**Repository**', 'Text', fullName],
    ['**Description**', 'Text', desc || '(not detected)'],
    ['**Default Ref**', 'Text', args.ref || '(unknown)'],
    ['**Stars**', 'Metric', Number.isFinite(stars) ? formatK(stars) : '(unknown)'],
    ['**Forks**', 'Metric', Number.isFinite(forks) ? formatK(forks) : '(unknown)'],
    ['**License**', 'Text', licenseSpdx || '(unknown)'],
  ])
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 📊 Repository Statistics')
  doc.push('')
  appendMarkdownTable(doc, ['Metric', 'Value'], [
    ['**Total Folders**', folderCount],
    ['**Core Python Files**', `${rootPy.length || 0}${rootPy.length ? '+' : ''} (root level)`],
    ['**Custom Nodes Support**', hasCustomNodes ? 'Yes' : 'Unknown'],
    ['**API Support**', apiSupport],
    ['**Supported Platforms**', platforms.length ? platforms.join(', ') : 'Unknown'],
    ['**GPU Support**', gpuTypes.length ? gpuTypes.join(', ') : 'Unknown'],
  ])
  doc.push('')

  if (readmeGroups.length) {
    doc.push('---')
    doc.push('')
    doc.push('## ⚡ Feature Sections (Extracted)')
    doc.push('')
    appendMarkdownTable(doc, ['Section', 'Items', 'Notes'], readmeGroups.slice(0, 10).map(g => [
      `**${g.title}**`, g.items.length, 'From README list items',
    ]))
    doc.push('')

    const icons = ['💻', '🧩', '🎬', '⚙️']
    let idx = 1
    for (const g of readmeGroups.slice(0, 4)) {
      doc.push('---'); doc.push('');
      doc.push(`## ${(icons[idx - 1] || '⚙️')} Section Statistics: ${g.title}`); doc.push('');
      doc.push(`- **List Items:** ${g.items.length}`); doc.push(`- **Unique Tokens:** ${new Set(g.items.map(x => x.toLowerCase())).size}`); doc.push('');
      appendMarkdownTable(doc, ['Item'], g.items.slice(0, 18).map(it => [it])); doc.push('');
      idx += 1
    }
  }

  doc.push('---')
  doc.push('')
  doc.push('## 🗂️ Directory Structure')
  doc.push('')
  doc.push('```')
  doc.push(renderTopLevelDirectoryTreeWithNotes({ rootName, allTreePaths: args.allTreePaths }))
  doc.push('```')
  doc.push('')
  doc.push('---')
  doc.push('')
  doc.push('## 🗂️ Directory Structure (Expanded)')
  doc.push('')
  doc.push('```')
  const filePaths = filterToLikelyFilePaths(args.allTreePaths)
  doc.push(renderRepoTreeAscii({ rootName, paths: filePaths, maxDepth: 4, maxChildrenPerFolder: 28 }))
  doc.push('```')
  doc.push('')

  if (rootFiles.length) {
    doc.push('---')
    doc.push('')
    doc.push('## 📄 Top-Level Files (Detected)')
    doc.push('')
    const rootFileRows: string[][] = []
    for (const f of rootFiles.slice(0, 36)) {
      const lower = f.toLowerCase()
      const note =
        lower === 'readme.md'
          ? 'Repository overview and usage'
          : lower.includes('license')
            ? 'License'
            : lower.includes('requirements') || lower.includes('pyproject')
              ? 'Dependencies'
              : lower.includes('docker')
                ? 'Containerization'
                : lower.includes('makefile')
                  ? 'Build automation'
                  : '—'
      rootFileRows.push([`\`${f}\``, note])
    }
    appendMarkdownTable(doc, ['File', 'Notes'], rootFileRows)
    doc.push('')
  }

  const releaseProcess = extractReadmeSectionBlockAny(args.readmeMarkdown, ['Release Process', 'Releases', 'Changelog', 'Release Notes'], 12_000)
  if (releaseProcess) {
    doc.push('---')
    doc.push('')
    doc.push('## 🗓️ Release Process (Extracted)')
    doc.push('')
    doc.push('```')
    doc.push(releaseProcess.trim())
    doc.push('```')
    doc.push('')
  }

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Core Entry Points & Dependencies')
  doc.push('')

  const keyFiles = detectRepoKeyFiles(args.allTreePaths, args.readmeMarkdown, 6)
  let sectionIdx = 1
  for (const k of keyFiles) {
    if (!args.allTreePaths.includes(k.file)) continue
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: k.file })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
    doc.push(`### ${sectionIdx}. ${k.title}`)
    doc.push('')
    if (!fetched.ok) {
      doc.push('(unavailable)')
      doc.push('')
      doc.push('---')
      doc.push('')
      sectionIdx += 1
      continue
    }
    if (/\.py$/i.test(k.file)) {
      const outline = extractPythonStructuredOutline(fetched.text, { maxTopLevelDefs: 18, maxClasses: 10, maxMethodsPerClass: 14, maxImports: 24 })
      const outlineRows: string[][] = []
      for (const d of outline.topLevelDefs) {
        const input = d.args ? d.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
        outlineRows.push([`\`${k.file}\``, 'N/A', `\`${d.name}()\``, input || '—', '—', d.doc || inferDecisionLogicNote(d.name)])
      }
      for (const c of outline.classes) {
        for (const m of c.methods.slice(0, 14)) {
          const input = m.args ? m.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
          outlineRows.push([`\`${k.file}\``, `\`${c.name}\``, `\`${m.name}()\``, input || '—', '—', m.doc || inferDecisionLogicNote(m.name)])
        }
      }
      appendMarkdownTable(doc, ['Module', 'Class/Object', 'Function/Method', 'Input', 'Output', 'Decision Logic'], outlineRows)
      doc.push('')
      if (outline.imports.length) {
        doc.push('**Dependencies:**')
        for (const imp of outline.imports.slice(0, 18)) doc.push(`- \`${imp}\``)
        doc.push('')
      }
    } else {
      doc.push('```')
      doc.push(fetched.text.slice(0, 1200).trimEnd())
      doc.push('```')
      doc.push('')
    }
    doc.push('---')
    doc.push('')
    sectionIdx += 1
  }

  const serverFile = args.allTreePaths.includes('server.py') ? 'server.py' : null
  if (serverFile) {
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: serverFile })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
    if (fetched.ok) {
      const routes = extractGitHubRoutesFromServerText(fetched.text, 24)
      if (routes.length) {
        doc.push('## 🧭 Key Routes (Heuristic)')
        doc.push('')
        appendMarkdownTable(doc, ['Route', 'Notes'], routes.map(route => [`\`${route}\``, 'Extracted from source strings']))
        doc.push('')
        doc.push('---')
        doc.push('')
      }
    }
  }

  const reqFile = args.allTreePaths.includes('requirements.txt') ? 'requirements.txt' : null
  if (reqFile) {
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: reqFile })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 250_000 })
    if (fetched.ok) {
      const deps = parseRequirements(fetched.text, 24)
      if (deps.length) {
        doc.push('## 📚 External Dependencies (requirements.txt)')
        doc.push('')
        appendMarkdownTable(doc, ['Package', 'Version/Spec'], deps.map(dep => [`\`${dep.pkg}\``, dep.spec]))
        doc.push('')
        doc.push('---')
        doc.push('')
      }
    }
  }

  const pyByTopDir = (() => {
    const counts = new Map<string, number>()
    for (const p of args.allTreePaths) {
      const lower = String(p || '').toLowerCase()
      if (!lower.endsWith('.py')) continue
      const parts = String(p).split('/').filter(Boolean)
      if (parts.length < 2) continue
      const top = parts[0]
      if (top.toLowerCase().includes('test')) continue
      counts.set(top, (counts.get(top) || 0) + 1)
    }
    return [...counts.entries()].map(([dir, count]) => ({ dir, count })).sort((a, b) => b.count - a.count || a.dir.localeCompare(b.dir))
  })()

  const topModuleDirs = pyByTopDir.slice(0, 2)
  if (topModuleDirs.length) {
    doc.push('## 📦 Core Modules Breakdown (Sampled)')
    doc.push('')
    doc.push('This section samples representative files from the largest code directories (heuristic, bounded).')
    doc.push('')
    for (const d of topModuleDirs) {
      doc.push(`### ${d.dir}/`)
      doc.push('')
      const candidates = args.allTreePaths
        .filter(p => p.startsWith(`${d.dir}/`) && p.toLowerCase().endsWith('.py'))
        .filter(p => !p.toLowerCase().includes('/test'))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 2)
      for (const file of candidates) {
        const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: file })
        const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
        doc.push(`#### ${file}`)
        doc.push('')
        if (!fetched.ok) {
          doc.push('(unavailable)')
          doc.push('')
          continue
        }
        const outline = extractPythonStructuredOutline(fetched.text, { maxTopLevelDefs: 10, maxClasses: 6, maxMethodsPerClass: 10, maxImports: 14 })
        const outlineRows: string[][] = []
        for (const td of outline.topLevelDefs) {
          const input = td.args ? td.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
          outlineRows.push([`\`${file}\``, 'N/A', `\`${td.name}()\``, input || '—', '—', td.doc || inferDecisionLogicNote(td.name)])
        }
        for (const c of outline.classes) {
          for (const m of c.methods.slice(0, 10)) {
            const input = m.args ? m.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
            outlineRows.push([`\`${file}\``, `\`${c.name}\``, `\`${m.name}()\``, input || '—', '—', m.doc || inferDecisionLogicNote(m.name)])
          }
        }
        appendMarkdownTable(doc, ['Module', 'Class/Object', 'Function/Method', 'Input', 'Output', 'Decision Logic'], outlineRows)
        doc.push('')
        if (outline.imports.length) {
          doc.push('**Dependencies:**')
          for (const imp of outline.imports.slice(0, 14)) doc.push(`- \`${imp}\``)
          doc.push('')
        }
      }
      doc.push('---')
      doc.push('')
    }
  }

  if (templateNames.length) {
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderTemplateGalleryGridTwoRows(templateNames))
    doc.push('```')
    doc.push('')
  }

  return doc.join('\n')
}
