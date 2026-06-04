export const inspectSharedDocumentStructure = (args = {}) => {
  const normalizeString = (value) => String(value || '').trim()
  const normalizeMarkdown = (value) => String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const readIndent = (line) => {
    const match = String(line || '').match(/^\s*/)
    return match ? match[0].length : 0
  }
  const isYamlKeyLine = (line) => /^[A-Za-z0-9_:@-]+\s*:/.test(normalizeString(line))
  const splitLines = (text) => normalizeMarkdown(text).split('\n')

  const extractLeadingFrontmatter = (markdown) => {
    const lines = splitLines(markdown)
    let start = 0
    while (start < lines.length && !normalizeString(lines[start])) start += 1
    if (normalizeString(lines[start]) !== '---') return null
    for (let i = start + 1; i < lines.length; i += 1) {
      if (normalizeString(lines[i]) !== '---') continue
      return {
        frontmatter: lines.slice(start + 1, i).join('\n'),
        body: lines.slice(i + 1).join('\n'),
      }
    }
    return null
  }

  const extractTopLevelFrontmatterKeys = (frontmatter) => {
    const keys = []
    for (const line of splitLines(frontmatter)) {
      if (!normalizeString(line) || readIndent(line) !== 0) continue
      const match = line.match(/^([A-Za-z0-9_:@-]+)\s*:/)
      if (!match?.[1]) continue
      keys.push(match[1])
    }
    return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b))
  }

  const extractYamlBlock = (text, key) => {
    const lines = splitLines(text)
    const expectedPrefix = `${key}:`
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const trimmed = normalizeString(line)
      if (!trimmed.startsWith(expectedPrefix)) continue
      const indent = readIndent(line)
      const inlineValue = trimmed.slice(expectedPrefix.length).trim()
      if (inlineValue) {
        return {
          indent,
          inlineValue,
          blockLines: [],
          blockText: '',
        }
      }
      const blockLines = []
      for (let j = i + 1; j < lines.length; j += 1) {
        const nextLine = lines[j]
        const nextTrimmed = normalizeString(nextLine)
        const nextIndent = readIndent(nextLine)
        if (nextTrimmed && nextIndent <= indent && isYamlKeyLine(nextLine)) break
        blockLines.push(nextLine)
      }
      return {
        indent,
        inlineValue: '',
        blockLines,
        blockText: blockLines.join('\n'),
      }
    }
    return null
  }

  const extractNestedYamlKeys = (blockText) => {
    const keys = []
    for (const line of splitLines(blockText)) {
      const trimmed = normalizeString(line)
      if (!trimmed || trimmed.startsWith('- ')) continue
      const match = trimmed.match(/^([A-Za-z0-9_:@-]+)\s*:/)
      if (!match?.[1]) continue
      keys.push(match[1])
    }
    return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b))
  }

  const extractDirectYamlKeys = (blockText) => {
    const lines = splitLines(blockText).filter(line => normalizeString(line))
    if (!lines.length) return []
    const minIndent = Math.min(...lines.map(readIndent))
    const keys = []
    for (const line of lines) {
      if (readIndent(line) !== minIndent) continue
      const trimmed = normalizeString(line)
      if (trimmed.startsWith('- ')) continue
      const match = trimmed.match(/^([A-Za-z0-9_:@-]+)\s*:/)
      if (!match?.[1]) continue
      keys.push(match[1])
    }
    return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b))
  }

  const countInlineSequenceEntries = (inlineValue) => {
    const trimmed = normalizeString(inlineValue)
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) return 0
    return inner.split(',').map((part) => normalizeString(part)).filter(Boolean).length
  }

  const cleanYamlScalar = (value) => {
    const trimmed = normalizeString(value)
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1)
    }
    return trimmed
  }

  const extractInlineSequenceValues = (inlineValue) => {
    const trimmed = normalizeString(inlineValue)
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map(part => cleanYamlScalar(part)).filter(Boolean)
  }

  const extractYamlSequenceValues = (text, key) => {
    const block = extractYamlBlock(text, key)
    if (!block) return []
    if (block.inlineValue) return extractInlineSequenceValues(block.inlineValue) || []
    const values = []
    const itemIndent = block.indent + 2
    for (const line of block.blockLines) {
      const trimmed = normalizeString(line)
      if (readIndent(line) !== itemIndent) continue
      if (!trimmed.startsWith('- ')) continue
      values.push(cleanYamlScalar(trimmed.slice(2)))
    }
    return values
  }

  const extractTopLevelScalarValue = (frontmatter, key) => {
    const lines = splitLines(frontmatter)
    const expectedPrefix = `${key}:`
    for (const line of lines) {
      const trimmed = normalizeString(line)
      if (!trimmed.startsWith(expectedPrefix)) continue
      return cleanYamlScalar(trimmed.slice(expectedPrefix.length))
    }
    return null
  }

  const countYamlSequenceEntries = (text, key) => {
    const block = extractYamlBlock(text, key)
    if (!block) return null
    if (block.inlineValue) return countInlineSequenceEntries(block.inlineValue)
    let count = 0
    const itemIndent = block.indent + 2
    for (const line of block.blockLines) {
      if (!normalizeString(line)) continue
      if (readIndent(line) !== itemIndent) continue
      if (/^\s*-\s+/.test(line)) count += 1
    }
    return count
  }

  const extractMarkdownHeadings = (body) => {
    const headings = []
    for (const line of splitLines(body)) {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
      if (!match?.[2]) continue
      headings.push({
        depth: match[1].length,
        text: normalizeString(match[2]),
      })
    }
    return headings
  }

  const workspaceId = normalizeString(args.workspaceId)
  const canonicalPath = normalizeString(args.canonicalPath)
  const markdown = normalizeMarkdown(args.markdown)
  const parsed = extractLeadingFrontmatter(markdown)
  const topLevelKeys = parsed ? extractTopLevelFrontmatterKeys(parsed.frontmatter) : []
  const flowBlock = parsed ? extractYamlBlock(parsed.frontmatter, 'flow') : null
  const flowKeys = flowBlock ? extractNestedYamlKeys(flowBlock.blockText) : []
  const mainPanelIntegrationsDemoBlock = parsed ? extractYamlBlock(parsed.frontmatter, 'main_panel_integrations_demo') : null
  const superAgentHarnessDemoBlock = parsed ? extractYamlBlock(parsed.frontmatter, 'superagent_harness_demo') : null
  const superAgentRuntimeSurfacesBlock = superAgentHarnessDemoBlock
    ? extractYamlBlock(superAgentHarnessDemoBlock.blockText, 'runtime_surfaces')
    : null
  const forbiddenGroupingAliasSet = new Set(['kg:subgraphs', 'clusters', 'groups', 'layers'])
  const forbiddenGroupingAliases = Array.from(
    new Set([...topLevelKeys, ...flowKeys].filter((key) => forbiddenGroupingAliasSet.has(key))),
  ).sort((a, b) => a.localeCompare(b))
  const headings = extractMarkdownHeadings(parsed ? parsed.body : markdown)

  return {
    workspaceId,
    canonicalPath,
    markdownLength: markdown.length,
    lineCount: markdown ? splitLines(markdown).length : 0,
    hasFrontmatter: Boolean(parsed),
    topLevelKeys,
    frontmatterScalars: parsed
      ? {
          kgCanvasRenderMode: extractTopLevelScalarValue(parsed.frontmatter, 'kgCanvasRenderMode'),
          kgCanvas2dRenderer: extractTopLevelScalarValue(parsed.frontmatter, 'kgCanvas2dRenderer'),
          deployed_api_claim: extractTopLevelScalarValue(parsed.frontmatter, 'deployed_api_claim'),
        }
      : {},
    mainPanelIntegrationsDemo: mainPanelIntegrationsDemoBlock
      ? {
          present: true,
          mainPanelEntries: extractYamlSequenceValues(mainPanelIntegrationsDemoBlock.blockText, 'main_panel_entries'),
          providerIds: extractYamlSequenceValues(mainPanelIntegrationsDemoBlock.blockText, 'provider_ids'),
          providerLabels: extractYamlSequenceValues(mainPanelIntegrationsDemoBlock.blockText, 'provider_labels'),
          taskCapabilities: extractYamlSequenceValues(mainPanelIntegrationsDemoBlock.blockText, 'task_capabilities'),
          taskLevels: extractYamlSequenceValues(mainPanelIntegrationsDemoBlock.blockText, 'task_levels'),
          integrationOpenTab: extractTopLevelScalarValue(mainPanelIntegrationsDemoBlock.blockText, 'integration_open_tab'),
          canvas2dRenderer: extractTopLevelScalarValue(mainPanelIntegrationsDemoBlock.blockText, 'canvas_2d_renderer'),
          sourceFile: extractTopLevelScalarValue(mainPanelIntegrationsDemoBlock.blockText, 'source_file'),
        }
      : { present: false },
    superAgentHarnessDemo: superAgentHarnessDemoBlock
      ? {
          present: true,
          taskCapabilities: extractYamlSequenceValues(superAgentHarnessDemoBlock.blockText, 'task_capabilities'),
          taskLevels: extractYamlSequenceValues(superAgentHarnessDemoBlock.blockText, 'task_levels'),
          runtimeSurfaces: superAgentRuntimeSurfacesBlock
            ? extractDirectYamlKeys(superAgentRuntimeSurfacesBlock.blockText)
            : [],
        }
      : { present: false },
    hasFlowBlock: Boolean(flowBlock),
    flowKeys,
    flowNodeCount: flowBlock ? countYamlSequenceEntries(flowBlock.blockText, 'nodes') : null,
    flowConnectionCount: flowBlock
      ? countYamlSequenceEntries(flowBlock.blockText, 'connections') ?? countYamlSequenceEntries(flowBlock.blockText, 'edges')
      : null,
    flowSubgraphCount: flowBlock ? countYamlSequenceEntries(flowBlock.blockText, 'subgraphs') : null,
    forbiddenGroupingAliases,
    headingCount: headings.length,
    headings: headings.map((heading) => heading.text),
    bodyLength: normalizeString(parsed ? parsed.body : markdown).length,
  }
}
