import React from 'react'
import { renderToString } from 'react-dom/server'
import GeospatialPanel from '@/features/geospatial/GeospatialPanel'

export function testUiMapTabRendersGeospatialPanel() {
  renderToString(<GeospatialPanel />)
}
