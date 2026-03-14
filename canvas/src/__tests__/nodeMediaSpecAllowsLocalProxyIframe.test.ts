import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export async function testNodeMediaSpecAllowsLocalProxyIframeUrl() {
  const node = {
    id: 'n1',
    type: 'IFrame',
    label: 'iframe',
    properties: {
      media_kind: 'iframe',
      iframe_url: '/__webpage_proxy?url=https%3A%2F%2Fexample.com%2F',
      media_url: '/__webpage_proxy?url=https%3A%2F%2Fexample.com%2F',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]
  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected getNodeMediaSpec to allow local proxy iframe urls')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
}

