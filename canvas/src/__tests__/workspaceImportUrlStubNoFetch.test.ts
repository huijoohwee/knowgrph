import path from 'node:path'

import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

async function assertStubFor(url: string) {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async () => {
    throw new Error('Unexpected fetch() during import stub')
  }) as unknown as typeof fetch
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (!res || typeof res.text !== 'string') throw new Error('Expected result text')
    if (!res.text.includes('kgWebpageUrl:')) throw new Error('Expected webpage frontmatter')
    if (!res.text.includes(url)) throw new Error('Expected URL in stub')
    if (!res.text.includes('kgWebpageView:')) throw new Error('Expected view in stub')
    if (res.text.includes('<html') || res.text.includes('<script')) throw new Error('Stub must not embed HTML')
  } finally {
    g.fetch = prev
  }
}

export async function testWorkspaceImportUrlStubDoesNotFetch(): Promise<void> {
  await assertStubFor('https://example.com/')
  await assertStubFor('https://vercel.com/')
}

export async function testWorkspaceImportUrlAcceptsAbsoluteFsPathViaViteFsFetch(): Promise<void> {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    return {
      ok: true,
      status: 200,
      text: async () => '# Local Demo\n',
    } as Response
  }) as unknown as typeof fetch
  try {
    const inputPath = path.resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'synthetic-local-import.md')
    const normalizedFsPath = inputPath.replace(/\\/g, '/')
    const res = await fetchWorkspaceUrlContent(inputPath, { mode: 'import' })
    if (calledUrl !== `/@fs${normalizedFsPath}`) {
      throw new Error(`expected absolute filesystem import to fetch through Vite /@fs, got ${String(calledUrl)}`)
    }
    if (res.normalizedUrl !== inputPath) {
      throw new Error(`expected absolute filesystem import to preserve the original source path, got ${String(res.normalizedUrl)}`)
    }
    if (res.name !== 'synthetic-local-import.md') {
      throw new Error(`expected absolute filesystem import to derive the source basename, got ${String(res.name)}`)
    }
    if (res.text !== '# Local Demo\n') {
      throw new Error('expected absolute filesystem import to return fetched markdown text verbatim')
    }
  } finally {
    g.fetch = prev
  }
}

export async function testWorkspaceImportUrlGlbFetchesBinaryManifest(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    const glbHeader = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0])
    return new Response(glbHeader, {
      status: 200,
      headers: { 'Content-Type': 'model/gltf-binary' },
    })
  }) as unknown as typeof fetch
  try {
    const sourceUrl = 'https://assets.example/models/scene.glb'
    const res = await fetchWorkspaceUrlContent(sourceUrl, { mode: 'import' })
    if (!calledUrl.startsWith('/__chat_asset_proxy?url=')) {
      throw new Error(`expected remote GLB URL import to fetch through binary proxy, got ${calledUrl}`)
    }
    if (res.name !== 'scene.glb') {
      throw new Error(`expected GLB URL import to preserve scene.glb, got ${res.name}`)
    }
    if (res.normalizedUrl !== sourceUrl) {
      throw new Error(`expected GLB URL import to preserve source URL, got ${res.normalizedUrl}`)
    }
    if (!res.text.includes('kgAssetFormat: "glb"')) throw new Error('expected GLB asset format frontmatter')
    if (!res.text.includes('kgAssetSource: "url"')) throw new Error('expected GLB URL source marker')
    if (!res.text.includes('kgAssetValidGlbMagic: true')) throw new Error('expected GLB magic validation flag')
    if (!res.text.includes('kgAssetEncoding: "base64-body"')) {
      throw new Error('expected GLB URL manifest to keep encoded model data outside frontmatter')
    }
    if (!res.text.includes('```kg-glb-base64')) {
      throw new Error('expected GLB URL manifest to embed chunked model data in a fenced payload')
    }
  } finally {
    g.fetch = prev
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlGltfFetchesJsonManifest(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    const gltf = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] })
    return new Response(gltf, {
      status: 200,
      headers: { 'Content-Type': 'model/gltf+json' },
    })
  }) as unknown as typeof fetch
  try {
    const sourceUrl = 'https://assets.example/models/scene.gltf'
    const res = await fetchWorkspaceUrlContent(sourceUrl, { mode: 'import' })
    if (!calledUrl.startsWith('/__chat_asset_proxy?url=')) {
      throw new Error(`expected remote GLTF URL import to fetch through model proxy, got ${calledUrl}`)
    }
    if (res.name !== 'scene.gltf') {
      throw new Error(`expected GLTF URL import to preserve scene.gltf, got ${res.name}`)
    }
    if (res.normalizedUrl !== sourceUrl) {
      throw new Error(`expected GLTF URL import to preserve source URL, got ${res.normalizedUrl}`)
    }
    if (!res.text.includes('kgAssetFormat: "gltf"')) throw new Error('expected GLTF asset format frontmatter')
    if (!res.text.includes('kgAssetSource: "url"')) throw new Error('expected GLTF URL source marker')
    if (!res.text.includes('kgAssetValidGltfJson: true')) throw new Error('expected GLTF JSON validation flag')
    if (!res.text.includes('kgAssetEncoding: "json-body"')) {
      throw new Error('expected GLTF URL manifest to keep model JSON outside frontmatter')
    }
    if (!res.text.includes('```kg-gltf-base64')) {
      throw new Error('expected GLTF URL manifest to embed chunked model JSON in a fenced payload')
    }
  } finally {
    g.fetch = prev
    resetWorkspaceUrlContentCacheForTests()
  }
}
