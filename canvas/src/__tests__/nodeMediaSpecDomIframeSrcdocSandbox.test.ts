import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export async function testNodeMediaSpecDomIframeSrcdocInjectsViewportCss() {
  const node = {
    id: 'dom:iframe:srcdoc:1',
    type: 'WebpageElement',
    label: 'IFRAME',
    metadata: {
      documentUrl: 'https://example.invalid/page',
    },
    properties: {
      'dom:tag': 'IFRAME',
      'dom:attrs:srcdoc': '<html><head></head><body><img src="x" width="2000" /><pre>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</pre></body></html>',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for dom iframe srcdoc')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  const srcDoc = String((spec as any).srcDoc || '')
  if (!srcDoc) throw new Error('expected iframe srcDoc')
  if (!srcDoc.includes('data-kg-srcdoc-viewport="1"')) throw new Error('expected srcdoc viewport style injection')
  if (!srcDoc.includes('img,video,svg,canvas,iframe{max-width:100%!important;height:auto;}')) {
    throw new Error('expected max-width guards for media elements')
  }
  if (!srcDoc.includes('pre,code{white-space:pre-wrap;word-break:break-word;}')) {
    throw new Error('expected overflow guards for pre/code text')
  }
}

export async function testNodeMediaSpecDomIframeSrcdocRejectsScripts() {
  const node = {
    id: 'dom:iframe:srcdoc:script',
    type: 'WebpageElement',
    label: 'IFRAME',
    properties: {
      'dom:tag': 'IFRAME',
      'dom:attrs:srcdoc': '<html><body><script>alert(1)</script></body></html>',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (spec) throw new Error('expected no media spec for dom iframe srcdoc containing scripts')
}

