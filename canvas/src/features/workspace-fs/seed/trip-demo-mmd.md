---
title: Trip Demo (MMD)
created: 2026-02-02
version: 1
---

# Trip Demo (Workspace Seed)

Use this file to sanity-check:

- Markdown Viewer
- Presentation mode (slides)
- Gallery renderer
- Mermaid rendering
- Embedded GeoJSON → geospatial layer integration

---

## Slides

---

### Slide 1

This is a slide.

---

### Slide 2

Inline media:

[![Video](https://img.youtube.com/vi/nvrJVxb55qY/maxresdefault.jpg)](https://www.youtube.com/watch?v=nvrJVxb55qY)

---

## Mermaid

```mermaid
graph LR
  SIN[Singapore] -->|flight| SYD[Sydney]
  SYD -->|flight| LAX[Los Angeles]
  LAX -->|flight| SIN
```

---

## GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Singapore" },
      "geometry": { "type": "Point", "coordinates": [103.8198, 1.3521] }
    },
    {
      "type": "Feature",
      "properties": { "name": "Sydney" },
      "geometry": { "type": "Point", "coordinates": [151.2093, -33.8688] }
    }
  ]
}
```
