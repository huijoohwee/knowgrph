import { parseGraph, exportAsCombinedCsvBlob, exportAsJsonLdBlob } from '@/lib/graph/io/adapter'

const sampleJsonLd = {
  '@context': { kg: 'http://example.org/kg#' },
  '@graph': [
    { '@id': 'kg:a', '@type': 'Company', name: 'A', 'kg:x': 10, 'kg:y': 20 },
    { '@id': 'kg:b', '@type': 'Investor', name: 'B' },
    { '@id': 'kg:e:1', 'kg:subject': 'kg:a', 'kg:predicate': 'investedIn', 'kg:object': 'kg:b', amount: 100 }
  ]
}

export function testRoundTripJsonLd() {
  const { data } = parseGraph('a.jsonld', JSON.stringify(sampleJsonLd))
  const blob = exportAsJsonLdBlob(data)
  return blob.text()
}

export function testRoundTripCsv() {
  const { data } = parseGraph('a.jsonld', JSON.stringify(sampleJsonLd))
  const blob = exportAsCombinedCsvBlob(data)
  return blob.text()
}
