---
title: Embedded GeoJSON Demo
graphId: md:embedded-geojson-demo
---

# Embedded GeoJSON

```geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "fc-1",
      "properties": { "name": "Polygon A" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0]
          ]
        ]
      }
    }
  ]
}
```

```geojson
{ "type": "FeatureCollection", "features": [] }
```

