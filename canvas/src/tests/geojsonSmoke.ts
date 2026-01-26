import { testMarkdownGeoJsonCodeBlockRegistersAsGeospatialDataset } from '@/__tests__/markdown/markdownGeoJsonOverlayRegistration.test'

async function main() {
  await testMarkdownGeoJsonCodeBlockRegistersAsGeospatialDataset()
  console.log('OK markdown.geojson.registersToGeo')
}

main().catch(err => {
  const msg =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message || err)
        : String(err)
  console.error(`FAIL markdown.geojson.registersToGeo — ${msg}`)
  process.exit(1)
})
