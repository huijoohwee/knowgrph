import { resolveUrlAgainstBase } from '@/lib/url'

export function testResolveUrlAgainstBaseResolvesRelativeUrls() {
  const base = 'https://example.com/path/page'
  if (resolveUrlAgainstBase(base, '/img.png') !== 'https://example.com/img.png') {
    throw new Error('expected /img.png to resolve to origin')
  }
  if (resolveUrlAgainstBase(base, 'img.png') !== 'https://example.com/path/img.png') {
    throw new Error('expected img.png to resolve relative to base path')
  }
  if (resolveUrlAgainstBase(base, 'https://cdn.example.com/a.png') !== 'https://cdn.example.com/a.png') {
    throw new Error('expected absolute url to be preserved')
  }
}

