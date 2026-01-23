import type { JSONValue } from '@/lib/graph/types'

export type LngLat = [number, number]

export type GeoPoint = {
  lat: number
  lng: number
}

export type GeoEntity = {
  id: string
  label: string
  type: string
  geo: GeoPoint
  properties: Record<string, JSONValue>
}

export type GeoEntityDistance = {
  id: string
  distanceKm: number
}

