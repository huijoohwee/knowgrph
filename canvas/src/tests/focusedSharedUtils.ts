import {
  testForbidSiblingRepoSourceImports,
  testHostGympgrphIntegrationUsesPackageRootOnly,
} from '@/__tests__/crossRepoBoundaryGuards.test'
import {
  testFetchRemoteTextPreflightHeadGuardsTooLarge,
  testFetchRemoteTextValidateSupportsStringAndArgs,
  testFetchRemoteTextWrapperUseProxyBoolean,
} from '@/__tests__/fetchRemoteTextInterop.test'
import {
  testGympgrphApplyMediaProxyNormalizesGithubBlobUrl,
  testGympgrphApplyMediaProxySkipsProxyWhenNotLocalhost,
  testGympgrphCoerceFetchUrlAcceptsAbsolutePath,
  testGympgrphCoerceFetchUrlTreatsAbsoluteFsPathAsViteFs,
  testGympgrphCoerceFetchUrlRejectsFileScheme,
} from '@/__tests__/gympgrphUrlInterop.test'
import { testGeospatialDatasetLoaderParsesEmbeddedGeoJsonFromMarkdownUrl } from '@/__tests__/markdownGeoIntegrationTripDemo.test'
import {
  testCoerceMediaUrlAcceptsSafeRelative,
  testCoerceMediaUrlRejectsExplicitScheme,
  testNormalizeImportNameDerivesJsonNameFromUrlAndFormat,
} from '@/__tests__/mediaUrlCoercion.test'

type TestCase = { name: string; run: () => unknown | Promise<unknown> }

const cases: TestCase[] = [
  { name: 'crossRepo: forbid sibling src imports', run: testForbidSiblingRepoSourceImports },
  { name: 'crossRepo: gympgrph uses package root only', run: testHostGympgrphIntegrationUsesPackageRootOnly },
  { name: 'fetchRemoteText: validate supports string+args', run: testFetchRemoteTextValidateSupportsStringAndArgs },
  { name: 'fetchRemoteText: preflight HEAD guards too large', run: testFetchRemoteTextPreflightHeadGuardsTooLarge },
  { name: 'fetchRemoteText: wrapper useProxy boolean', run: testFetchRemoteTextWrapperUseProxyBoolean },
  { name: 'gympgrph url: apply media proxy normalizes github blob', run: testGympgrphApplyMediaProxyNormalizesGithubBlobUrl },
  { name: 'gympgrph url: apply media proxy skips when not localhost', run: testGympgrphApplyMediaProxySkipsProxyWhenNotLocalhost },
  { name: 'gympgrph url: coerce fetch url accepts absolute path', run: testGympgrphCoerceFetchUrlAcceptsAbsolutePath },
  { name: 'gympgrph url: coerce fetch url rewrites absolute fs path to /@fs', run: testGympgrphCoerceFetchUrlTreatsAbsoluteFsPathAsViteFs },
  { name: 'gympgrph url: coerce fetch url rejects file scheme', run: testGympgrphCoerceFetchUrlRejectsFileScheme },
  { name: 'gympgrph geo: markdown url embeds geojson loads as dataset', run: testGeospatialDatasetLoaderParsesEmbeddedGeoJsonFromMarkdownUrl },
  { name: 'media url: coerce accepts safe relative', run: testCoerceMediaUrlAcceptsSafeRelative },
  { name: 'media url: coerce rejects explicit scheme', run: testCoerceMediaUrlRejectsExplicitScheme },
  { name: 'import naming: derive filename from url+format', run: testNormalizeImportNameDerivesJsonNameFromUrlAndFormat },
]

async function main() {
  const failed: Array<{ name: string; error: unknown }> = []
  for (const t of cases) {
    try {
      await Promise.resolve(t.run())
      console.log(`OK ${t.name}`)
    } catch (err) {
      console.log(`FAIL ${t.name}`)
      failed.push({ name: t.name, error: err })
    }
  }
  if (failed.length) {
    failed.forEach(f => {
      const msg =
        f.error instanceof Error
          ? f.error.message
          : f.error && typeof f.error === 'object' && 'message' in f.error
            ? String((f.error as { message?: unknown }).message || f.error)
            : String(f.error)
      console.log(`FAIL ${f.name} — ${msg}`)
    })
    process.exit(1)
  }
}

main()
