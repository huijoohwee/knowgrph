export function assertExternalMcpBridgeIdsAreRuntimeExecutable(text: string): void {
  ;[
    'knowgrph.tool.catalog',
    'knowgrph.tool.search',
    'knowgrph.tool.describe',
    'knowgrph.tool.call',
    'Runtime-executable',
  ].forEach(token => {
    if (!text.includes(token)) {
      throw new Error(`expected external MCP runtime contract to preserve ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
  ;['planned target', 'deferred schema access', 'documented-only'].forEach(token => {
    if (text.includes(token)) {
      throw new Error(`expected external MCP runtime contract to remove stale wording ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}
