export function assertDeferredExternalMcpBridgeIdsStayDocumentedContract(text: string): void {
  ;[
    'knowgrph.tool.catalog',
    'knowgrph.tool.search',
    'knowgrph.tool.describe',
    'knowgrph.tool.call',
    'deferred schema access',
    'pattern-only',
  ].forEach(token => {
    if (!text.includes(token)) {
      throw new Error(`expected external MCP bridge contract to preserve ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
  ;[
    'runtime-executable',
    'live runtime owner',
    'shipped runtime owner',
  ].forEach(token => {
    if (text.includes(token)) {
      throw new Error(`expected deferred external MCP bridge contract to avoid executable-runtime wording ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}


