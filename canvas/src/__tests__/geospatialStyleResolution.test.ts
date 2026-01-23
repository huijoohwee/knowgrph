import { resolveStyleUrls } from '@/features/geospatial/geospatialOverlayUtils'

export function testGeospatialStyleResolvesRelativeUrls() {
  const styleUrl = 'https://example.com/styles/liberty/style.json'
  const raw = {
    version: 8,
    sprite: './sprite',
    glyphs: '../fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'vector',
        tiles: ['../tiles/{z}/{x}/{y}.pbf'],
      },
      direct: {
        type: 'vector',
        tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
      },
    },
    layers: [],
  }

  const out = resolveStyleUrls(styleUrl, raw)
  if (!out || typeof out !== 'object' || Array.isArray(out)) throw new Error('expected style object')
  const style = out as Record<string, unknown>

  if (style.sprite !== 'https://example.com/styles/liberty/sprite') throw new Error('sprite URL was not resolved')
  if (style.glyphs !== 'https://example.com/styles/fonts/{fontstack}/{range}.pbf') throw new Error('glyphs URL was not resolved')

  const sources = style.sources as Record<string, unknown>
  const osm = sources.osm as Record<string, unknown>
  const tiles = osm.tiles as unknown[]
  if (!Array.isArray(tiles) || tiles[0] !== 'https://example.com/styles/tiles/{z}/{x}/{y}.pbf') {
    throw new Error('vector tile URL was not resolved')
  }

  const direct = sources.direct as Record<string, unknown>
  const directTiles = direct.tiles as unknown[]
  if (!Array.isArray(directTiles) || directTiles[0] !== 'https://tiles.example.com/{z}/{x}/{y}.pbf') {
    throw new Error('absolute tile URL should remain unchanged')
  }
}

