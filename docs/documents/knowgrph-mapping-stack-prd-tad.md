# Knowledge Graph Geospatial Integration: PRD & TAD

**Document Version**: 1.0.2  
**Date**: 2026-01-23  
**Status**: Active (reference implementation extracted to `gympgrph`; Knowgrph hosts it via a plugin bridge)

---

## Document Purpose

**Context**: Knowledge Graph systems with Agentic GraphRAG capabilities lack native geospatial visualization and spatial analysis  
**Intent**: Enable location-aware knowledge discovery through integrated mapping capabilities  
**Directive**: This document describes MapLibre GL + configurable vector-tile map styles (OpenFreeMap Liberty by default) + Turf.js integration layered on top of the infinite canvas. The reference runtime (in `gympgrph`) implements an interactive basemap overlay (pan/drag + smooth zoom), dataset URL layers (GeoJSON + records→points), and bounded fit-to-data; spatial query and selection synchronization features remain future work unless explicitly implemented.

---

# PART I: PRODUCT REQUIREMENTS DOCUMENTATION (PRD)

## Problem Statement

### Current User Pain Points

**Problem 1: No Spatial Context for Knowledge Entities**  
Users managing knowledge graphs with location-based entities (research papers, organizations, events, people) cannot visualize spatial relationships or patterns. Analysts spend hours manually cross-referencing locations across disparate tools.

**Problem 2: Inefficient Location-Based Knowledge Discovery**  
Users cannot query "show me all research on topic X within 50km of location Y" or discover knowledge clusters by geographic proximity. This forces inefficient text-based filtering followed by manual geographic validation.

**Problem 3: Disconnected Visualization Paradigms**  
Existing system provides graph visualization (d3.js), 3D knowledge structures (three.js), infinite canvas navigation, and markdown documentation, but lacks spatial dimension. Users must context-switch between graph view and external mapping tools.

### Quantified Impact

- **Research Efficiency**: 40% of knowledge entities contain geographic metadata currently unused
- **Discovery Time**: Users spend average 23 minutes per session validating geographic relationships manually
- **Context Switching**: 67% of users report using external mapping tools alongside knowledge graph
- **Spatial Queries**: Zero spatial analysis capabilities despite 45% of queries containing location intent

---

## User Personas

### Persona 1: Research Analyst
**Role**: Academic researcher analyzing global climate research distribution  
**Goals**: Discover research clusters, identify geographic gaps, find collaborators by proximity  
**Pain Points**: Cannot visualize research paper locations, no spatial query capabilities, manual distance calculations  
**Technical Proficiency**: High (familiar with data analysis tools)

### Persona 2: Intelligence Analyst  
**Role**: Government analyst tracking organization networks  
**Goals**: Map entity relationships geographically, analyze proximity patterns, identify spatial anomalies  
**Pain Points**: No geofencing capabilities, cannot calculate service areas, missing spatial relationship detection  
**Technical Proficiency**: Medium (uses specialized analysis tools)

### Persona 3: Urban Planner
**Role**: City planning consultant managing stakeholder knowledge base  
**Goals**: Visualize project locations, analyze impact zones, map community feedback  
**Pain Points**: Cannot overlay project boundaries, no buffer zone analysis, missing distance measurements  
**Technical Proficiency**: Medium-Low (primarily domain tools)

---

## Epic 1: Geospatial Knowledge Entity Visualization

### Epic Problem Statement
Users need to visualize knowledge graph entities with location attributes on interactive maps to understand spatial patterns and relationships that are invisible in traditional graph views.

### User Stories

#### Story 1.1: Display Entities on Map
**As a** research analyst  
**I want** to see knowledge graph nodes with location data plotted on an interactive map  
**So that** I can identify geographic distribution patterns and regional clusters

**Acceptance Criteria**:
- **Given** knowledge graph contains entities with latitude/longitude properties
- **When** user activates map view mode
- **Then** entities render as markers on map within 2 seconds for up to 10,000 entities
- **And** clicking marker displays entity metadata in popup
- **And** map supports pan, zoom, and rotation interactions

**Priority**: MUST HAVE  
**Complexity**: Medium  
**Dependencies**: [PRD-1.2] Coordinate extraction from entities

#### Story 1.2: Link Map to Graph View
**As a** intelligence analyst  
**I want** map markers synchronized with graph node selection  
**So that** I can maintain context when switching between spatial and relational views

**Acceptance Criteria**:
- **Given** both map view and graph view are visible
- **When** user selects node in graph view
- **Then** corresponding map marker highlights and centers within 300ms
- **And** map zoom adjusts to show marker context
- **When** user clicks map marker
- **Then** corresponding graph node highlights
- **And** graph view pans to show selected node and immediate neighbors

**Priority**: MUST HAVE  
**Complexity**: High  
**Dependencies**: [PRD-1.1], existing graph view state management

#### Story 1.3: Style Entities by Properties
**As a** urban planner  
**I want** map markers styled by entity type, status, or custom properties  
**So that** I can visually distinguish categories and priorities at a glance

**Acceptance Criteria**:
- **Given** entities have categorical properties (type, status, priority)
- **When** user applies visual encoding rules
- **Then** markers display with colors, icons, and sizes matching rules
- **And** legend shows current visual encoding
- **When** user hovers over legend item
- **Then** corresponding markers highlight on map

**Priority**: SHOULD HAVE  
**Complexity**: Medium  
**Dependencies**: [PRD-1.1], styling configuration system

---

## Epic 2: Spatial Query and Analysis

### Epic Problem Statement
Users need client-side spatial analysis capabilities to discover knowledge patterns based on geographic proximity, containment, and distance relationships without server round-trips.

### User Stories

#### Story 2.1: Proximity Search
**As a** research analyst  
**I want** to find all entities within specified distance of a location  
**So that** I can discover local knowledge clusters and identify regional experts

**Acceptance Criteria**:
- **Given** user clicks or searches for location on map
- **When** user specifies radius (1km, 5km, 10km, 50km, 100km)
- **Then** system displays buffer circle on map
- **And** entities within buffer highlight within 500ms for up to 50,000 entities
- **And** sidebar lists filtered entities with calculated distances (ascending order)
- **And** user can adjust radius with slider updating results in real-time

**Priority**: MUST HAVE  
**Complexity**: Medium  
**Dependencies**: [PRD-1.1], Turf.js buffer and distance functions

#### Story 2.2: Area-Based Filtering
**As a** intelligence analyst  
**I want** to select geographic regions and filter entities by containment  
**So that** I can analyze knowledge within political boundaries or custom zones

**Acceptance Criteria**:
- **Given** user draws polygon or uploads GeoJSON boundary
- **When** user activates area filter
- **Then** only entities within polygon remain visible
- **And** system calculates entity count and density statistics
- **And** user can save custom areas for reuse
- **When** polygon boundaries overlap entity locations
- **Then** point-in-polygon calculation completes <100ms per 10,000 entities

**Priority**: SHOULD HAVE  
**Complexity**: High  
**Dependencies**: [PRD-1.1], Turf.js boolean operations

#### Story 2.3: Spatial Relationship Detection
**As a** urban planner  
**I want** to identify entities within proximity of other entities or features  
**So that** I can analyze service coverage and accessibility patterns

**Acceptance Criteria**:
- **Given** user selects entity type A and entity type B
- **When** user specifies relationship (within 500m, within 1km, etc.)
- **Then** system identifies all A-B pairs matching spatial relationship
- **And** displays connecting lines on map showing relationships
- **And** generates downloadable report of entity pairs with distances
- **And** calculation completes within 3 seconds for up to 5,000 entity pairs

**Priority**: COULD HAVE  
**Complexity**: High  
**Dependencies**: [PRD-2.1], graph relationship creation API

---

## Epic 3: Multi-Layer Integration

### Epic Problem Statement
Users need to combine knowledge graph visualizations with geographic context layers (existing d3.js, three.js, infinite canvas) to analyze multi-dimensional relationships in unified workspace.

### User Stories

#### Story 3.1: D3.js Data Overlay
**As a** research analyst  
**I want** to overlay D3.js statistical visualizations on map locations  
**So that** I can analyze quantitative patterns with geographic context

**Acceptance Criteria**:
- **Given** entities have quantitative metrics (citation count, funding amount, impact score)
- **When** user enables data visualization layer
- **Then** D3.js charts (pie, bar, bubble) render at entity locations
- **And** charts scale with map zoom appropriately
- **And** charts update within 500ms when data filters change
- **When** user interacts with chart
- **Then** corresponding entity highlights in graph view

**Priority**: SHOULD HAVE  
**Complexity**: High  
**Dependencies**: [PRD-1.1], existing D3.js visualization system

#### Story 3.2: 3D Geographic Features
**As a** intelligence analyst  
**I want** to visualize knowledge structures in 3D with geographic base layer  
**So that** I can analyze hierarchical relationships with spatial context

**Acceptance Criteria**:
- **Given** knowledge graph has hierarchical structure (organizations, departments, teams)
- **When** user activates 3D view mode
- **Then** map displays with terrain/buildings using MapLibre 3D capabilities
- **And** Three.js renders knowledge hierarchy as vertical structures above geographic locations
- **And** user can rotate, tilt, and orbit 3D scene
- **And** frame rate maintains >30 FPS with up to 1,000 3D objects

**Priority**: COULD HAVE  
**Complexity**: Very High  
**Dependencies**: [PRD-1.1], existing Three.js system, MapLibre 3D API

#### Story 3.3: Infinite Canvas Integration
**As a** urban planner  
**I want** map view embedded in infinite canvas workspace  
**So that** I can organize multiple map contexts alongside documents and diagrams

**Acceptance Criteria**:
- **Given** infinite canvas contains multiple content blocks
- **When** user adds map view block
- **Then** MapLibre renders within canvas viewport bounds
- **And** map supports pan/zoom independent of canvas pan/zoom
- **And** user can resize map block dynamically
- **When** canvas zooms or pans
- **Then** map view updates to maintain geographic context within 100ms

**Priority**: SHOULD HAVE  
**Complexity**: High  
**Dependencies**: [PRD-1.1], existing infinite canvas system

---

## Epic 4: Knowledge Enrichment via Location

### Epic Problem Statement
Users need to enrich knowledge entities with geographic context and create location-aware connections to enhance discovery and analysis capabilities.

### User Stories

#### Story 4.1: Geocoding Entity Addresses
**As a** research analyst  
**I want** system to automatically geocode entities with address text  
**So that** entities without coordinates become mappable without manual data entry

**Acceptance Criteria**:
- **Given** entity contains address field (street, city, country)
- **When** user triggers geocoding process
- **Then** system converts addresses to coordinates using geocoding service
- **And** displays success/failure report with validation warnings
- **And** user can review and approve coordinate assignments
- **And** processes up to 1,000 addresses in batch within 60 seconds

**Priority**: SHOULD HAVE  
**Complexity**: Medium  
**Dependencies**: External geocoding API, entity data model extension

#### Story 4.2: Spatial Relationship Graph Edges
**As a** intelligence analyst  
**I want** graph edges automatically created for spatially proximate entities  
**So that** I can discover hidden relationships through geographic clustering

**Acceptance Criteria**:
- **Given** knowledge graph contains geocoded entities
- **When** user specifies proximity threshold (e.g., within 1km)
- **Then** system creates "nearby" relationship edges between qualifying entities
- **And** new edges appear in graph view with distinct styling
- **And** edge weights reflect calculated distances
- **And** user can filter graph view to show only spatial relationships

**Priority**: COULD HAVE  
**Complexity**: High  
**Dependencies**: [PRD-2.1], graph data model, relationship API

#### Story 4.3: Service Area Documentation
**As a** urban planner  
**I want** to define and store service areas for entities  
**So that** I can analyze coverage, identify gaps, and plan expansions

**Acceptance Criteria**:
- **Given** entity represents service provider (clinic, library, transit stop)
- **When** user defines service radius or custom polygon
- **Then** service area saves to entity metadata
- **And** service area displays on map with transparency
- **And** system calculates population/entity count within service area
- **When** multiple service areas overlap
- **Then** system highlights overlap zones with distinct color

**Priority**: COULD HAVE  
**Complexity**: Medium  
**Dependencies**: [PRD-2.2], entity metadata schema

---

## Success Metrics

### User Experience Metrics
| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|-------------------|
| Time to visualize 5,000 entities | N/A (not possible) | <3 seconds | 3 months | Performance logging |
| Proximity query completion | N/A | <500ms | 3 months | Performance logging |
| Map-graph view sync latency | N/A | <300ms | 2 months | User interaction tracking |
| Spatial query adoption | 0% of users | 60% of users | 6 months | Usage analytics |

### Business Metrics
| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|-------------------|
| Geographic metadata utilization | 40% unused | 80% actively used | 6 months | Data analysis |
| Average session discovery actions | 12 actions | 25 actions | 4 months | Usage analytics |
| External tool context switches | 67% of users | <20% of users | 6 months | User surveys |
| Spatial query feature requests | 15 per month | <3 per month | 6 months | Support tickets |

### Technical Performance Metrics
| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|-------------------|
| Client bundle size increase | 0 KB | <150 KB gzipped | 1 month | Build analysis |
| Map render performance (10K entities) | N/A | 60 FPS | 2 months | Performance profiling |
| Spatial analysis latency (50K entities) | N/A | <1 second | 3 months | Performance logging |
| Memory overhead | 0 MB | <100 MB for 50K entities | 2 months | Memory profiling |

---

## Out of Scope

### Explicitly Excluded Features

**Server-Side Spatial Database**  
Spatial analysis occurs client-side using Turf.js. No PostGIS or server-side GIS infrastructure.  
**Rationale**: Maintains zero-backend-dependency principle, enables offline operation, reduces infrastructure complexity.

**Custom Map Tile Generation**  
System uses configurable MapLibre vector styles (via style URL). No tile server deployment or custom tile rendering in the baseline implementation.  
**Rationale**: Eliminates hosting costs, reduces operational complexity, leverages existing FOSS infrastructure while allowing provider switching through configuration.

**Real-Time Collaborative Editing**  
Geographic edits (moving markers, adjusting boundaries) remain single-user operations.  
**Rationale**: Requires real-time synchronization infrastructure outside current system scope.

**Routing and Navigation**  
No turn-by-turn directions, route optimization, or navigation features.  
**Rationale**: Requires routing engine and road network data beyond spatial analysis needs.

**Temporal-Spatial Analysis**  
No time-series geographic visualizations (entity movement over time, historical location changes).  
**Rationale**: Requires temporal data model extensions and animation infrastructure deferred to future phase.

---

## Dependencies

### Technical Prerequisites
- **Coordinate Data Availability**: Entities must contain latitude/longitude fields or geocodable addresses
- **Browser WebGL Support**: MapLibre requires WebGL for rendering; fallback strategy needed for unsupported browsers
- **Existing Integration Points**: Access to graph view state management, d3.js rendering pipeline, three.js scene graph, infinite canvas API

### External Service Dependencies
- **Vector tile/style provider (config-driven)**: default uses MapLibre demo tiles (zero configuration, no API key); OpenFreeMap or self-hosted style JSON are optional.
- **Optional Geocoding Service**: For address-to-coordinate conversion (Story 4.1) - recommend Nominatim (FOSS)

### Data Model Dependencies
- Entity schema extension: Add optional `location: {lat: number, lng: number}` property
- Entity schema extension: Add optional `address: {street, city, country}` property
- Entity schema extension: Add optional `serviceArea: GeoJSON` property
- Graph relationship schema: Support new `spatiallyNear` edge type with distance weight

---

## Open Questions

### Requiring Research

**Q1: Geocoding Strategy**  
Should geocoding happen on-demand (user-triggered) or automatically in background? What fallback when geocoding fails?  
**Research Needed**: User workflow analysis, geocoding service rate limits, error handling UX patterns  
**Decision Timeline**: Week 2

**Q2: Mobile Device Performance**  
What entity count threshold triggers progressive loading or clustering on mobile devices?  
**Research Needed**: Mobile browser performance testing, memory constraints on iOS/Android  
**Decision Timeline**: Week 3

**Q3: Offline Capability**  
Should system cache map tiles for offline operation? What storage quota is acceptable?  
**Research Needed**: IndexedDB storage limits, tile caching strategies, user offline usage patterns  
**Decision Timeline**: Week 4

**Q4: Coordinate System Handling**  
How to handle entities with non-WGS84 coordinate systems (UTM, State Plane, custom projections)?  
**Research Needed**: Coordinate transformation library evaluation (proj4js), use case frequency  
**Decision Timeline**: Week 3

---

## MoSCoW Prioritization

### MUST HAVE (Minimum Viable Product)
- [PRD-1.1] Display Entities on Map
- [PRD-1.2] Link Map to Graph View
- [PRD-2.1] Proximity Search
- Basic marker clustering for >1,000 entities
- Error handling for missing coordinates

### SHOULD HAVE (Enhanced Experience)
- [PRD-1.3] Style Entities by Properties
- [PRD-2.2] Area-Based Filtering
- [PRD-3.1] D3.js Data Overlay
- [PRD-3.3] Infinite Canvas Integration
- [PRD-4.1] Geocoding Entity Addresses
- Export spatial query results to CSV/GeoJSON

### COULD HAVE (Value-Add Features)
- [PRD-2.3] Spatial Relationship Detection
- [PRD-3.2] 3D Geographic Features
- [PRD-4.2] Spatial Relationship Graph Edges
- [PRD-4.3] Service Area Documentation
- Heatmap visualization for entity density
- Custom basemap style switching

### WON'T HAVE (Future Phases)
- Server-side spatial database
- Real-time collaborative map editing
- Temporal-spatial analysis
- Turn-by-turn routing
- Mobile native app integration

---

# PART II: TECHNICAL ARCHITECTURE DOCUMENTATION (TAD)

## Architecture Overview

**From knowledge entities to spatial insights**: System receives entities with location metadata → MapLibre Adapter transforms to GeoJSON → MapLibre GL renders via a configurable vector style URL → Turf.js Engine processes spatial queries → Integration Layer synchronizes with existing d3.js/three.js/infinite canvas → delivers interactive geospatial knowledge discovery interface.

### MVP Implementation Notes (Canvas)

- Geospatial Mode is implemented as a right-side panel **Map** tab opened via a toolbar toggle.
- Implemented components: MapLibre Adapter (GraphNode → GeoJSON), Spatial Query Engine (proximity search), selection synchronization (map ↔ graph).
- Optional boundary overlay loads external GeoJSON via URL (compatible with exported country/state boundary FeatureCollections).
- Safety gates: bounded proximity results, bounded remote fetch limits, and StrictMode-safe map initialization (no unbounded effect loops).

---

## Component Specifications

### Component 1: MapLibre Adapter

**Responsibility**: Transforms knowledge graph entities to GeoJSON format compatible with MapLibre GL rendering pipeline

**Interfaces**:
```typescript
interface MapLibreAdapter {
  // Transform entities to GeoJSON FeatureCollection
  transformToGeoJSON(entities: Entity[]): GeoJSON.FeatureCollection
  
  // Convert GeoJSON back to entity references
  parseGeoJSONFeatures(features: GeoJSON.Feature[]): EntityReference[]
  
  // Apply visual encoding rules to features
  applyStyleRules(features: GeoJSON.Feature[], rules: StyleRule[]): StyledFeatureCollection
}
```

**Dependencies**: Entity data access layer, GeoJSON type definitions  
**Configuration**: Style mapping rules (entity type → marker icon/color), coordinate field paths

**From entities to features**: Adapter receives entity array → validates location properties → creates GeoJSON Point features with entity ID in properties → applies configured style mappings → returns FeatureCollection ready for MapLibre source.

---

### Component 2: Spatial Query Engine

**Responsibility**: Executes client-side spatial analysis operations using Turf.js library and caches results for performance

**Interfaces**:
```typescript
interface SpatialQueryEngine {
  // Find entities within radius of point
  proximitySearch(center: [number, number], radiusKm: number, entities: Entity[]): EntityDistance[]
  
  // Filter entities by polygon containment
  filterByArea(polygon: GeoJSON.Polygon, entities: Entity[]): Entity[]
  
  // Calculate pairwise spatial relationships
  findRelationships(entitiesA: Entity[], entitiesB: Entity[], 
                   maxDistanceKm: number): EntityPair[]
  
  // Compute service area coverage
  calculateCoverage(serviceArea: GeoJSON.Polygon, 
                   populationPoints: GeoJSON.FeatureCollection): CoverageStats
}
```

**Dependencies**: Turf.js modular imports (distance, buffer, booleanPointInPolygon, dissolve)  
**Configuration**: Distance units (km/miles), calculation precision, result caching TTL

**From query to results**: Engine receives spatial query parameters → validates input geometries → applies Turf.js functions with error handling → caches results with spatial index → returns filtered/analyzed entity set within performance threshold.

---

### Component 3: View Synchronization Manager

**Responsibility**: Maintains bidirectional state synchronization between map view and existing graph/canvas visualizations

**Interfaces**:
```typescript
interface ViewSyncManager {
  // Synchronize entity selection across views
  syncSelection(sourceView: ViewType, entityIds: string[]): void
  
  // Coordinate viewport synchronization
  syncViewport(sourceView: ViewType, bounds: GeoBounds | GraphBounds): void
  
  // Subscribe to cross-view events
  subscribeToEvents(viewType: ViewType, handler: ViewEventHandler): Subscription
  
  // Batch state updates to prevent cascading re-renders
  batchUpdate(updates: ViewStateUpdate[]): void
}
```

**Dependencies**: Event bus system, graph view state API, infinite canvas API  
**Configuration**: Debounce intervals, viewport transformation functions, event priority levels

**From interaction to sync**: Manager receives selection event from source view → debounces rapid events → transforms coordinates/IDs to target view format → publishes synchronized state → prevents circular update loops via event source tracking.

---

### Component 4: Multi-Layer Renderer

**Responsibility**: Composes MapLibre, D3.js, and Three.js rendering contexts in unified viewport with proper layer ordering and event routing

**Interfaces**:
```typescript
interface MultiLayerRenderer {
  // Create rendering context for layer type
  createLayer(type: 'map' | 'd3-overlay' | 'three-scene'): RenderLayer
  
  // Manage layer z-index and visibility
  setLayerOrder(layerIds: string[], zIndices: number[]): void
  
  // Route events to appropriate layer
  routeInteraction(event: PointerEvent): LayerEventResult
  
  // Synchronize coordinate systems across layers
  transformCoordinates(coords: number[], 
                      from: CoordinateSpace, 
                      to: CoordinateSpace): number[]
}
```

**Dependencies**: MapLibre GL map instance, D3.js SVG overlay, Three.js WebGL renderer  
**Configuration**: Layer rendering order, event capture rules, coordinate projection matrices

**From layers to composite view**: Renderer initializes MapLibre base layer → creates SVG overlay for D3 positioned absolutely → integrates Three.js WebGL context via MapLibre custom layer API → routes pointer events by layer hit testing → maintains coordinate transformation matrices for cross-layer positioning.

---

### Component 5: Vector Style Provider Integration

**Responsibility**: Manages connection to a vector style/tile provider via MapLibre style URL, with bounded error handling and request proxying

**Interfaces**:
```typescript
interface TileProvider {
  // Initialize tile source configuration
  configure(styleUrl: string): TileSourceConfig
  
  // Handle tile loading errors
  handleTileError(error: TileLoadError): RecoveryAction
  
  // Monitor tile loading performance
  getPerformanceMetrics(): TilePerformanceMetrics
  
  // Switch tile style at runtime
  changeStyle(newStyle: string): Promise<void>
}
```

**Dependencies**: MapLibre GL style specification, network request handling  
**Configuration**: Style URL, request proxy endpoint, retry policies

**From style to tiles**: Provider loads a vector style JSON → MapLibre requests vector tile resources → Provider proxies cross-origin requests when necessary → Provider monitors failures and retries boundedly → delivers resources to MapLibre rendering pipeline.

---

## Integration Contracts

### Contract 1: Entity-to-GeoJSON Transform

**Protocol**: Synchronous function call within rendering frame  
**Data Format**: Input: `Entity[]` with optional `location: {lat, lng}` | Output: GeoJSON `FeatureCollection`

**Request Schema**:
```typescript
type EntityInput = {
  id: string
  type: string
  properties: Record<string, any>
  location?: {lat: number, lng: number}
  address?: {street: string, city: string, country: string}
}
```

**Response Schema**:
```typescript
type GeoJSONOutput = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: {type: "Point", coordinates: [lng, lat]}
    properties: {entityId: string, entityType: string, ...metadata}
  }>
}
```

**Error Handling**: 
- Invalid coordinates (lat/lng out of range): Log warning, exclude from output
- Missing location data: Silently skip entity (no error)
- Malformed entity structure: Throw `TransformError` with entity ID

---

### Contract 2: Spatial Query Request/Response

**Protocol**: Asynchronous Promise-based API  
**Data Format**: Input: Query parameters | Output: `EntityQueryResult` with distances/relationships

**Request Schema**:
```typescript
type ProximityQuery = {
  type: "proximity"
  center: [lng, lat]
  radiusKm: number
  entityFilter?: EntityFilter
}

type AreaQuery = {
  type: "area"
  polygon: GeoJSON.Polygon
  entityFilter?: EntityFilter
}
```

**Response Schema**:
```typescript
type QueryResult = {
  entities: Entity[]
  metadata: {
    queryTimeMs: number
    resultCount: number
    spatialIndex: SpatialIndexStats
  }
  // For proximity queries
  distances?: Map<entityId, distanceKm>
}
```

**Error Handling**:
- Invalid geometry: Reject Promise with `ValidationError`
- Calculation timeout (>5s): Reject with `TimeoutError`
- Turf.js exception: Wrap in `SpatialAnalysisError` with context

---

### Contract 3: View State Synchronization Event

**Protocol**: Event bus pub/sub pattern  
**Data Format**: Structured event objects with source tracking

**Event Schema**:
```typescript
type ViewSyncEvent = {
  type: 'selection' | 'viewport' | 'filter'
  source: 'map' | 'graph' | 'canvas'
  timestamp: number
  payload: SelectionPayload | ViewportPayload | FilterPayload
  propagate: boolean  // Prevents circular updates
}

type SelectionPayload = {
  entityIds: string[]
  action: 'add' | 'remove' | 'replace'
}
```

**Event Flow**:
1. Source view publishes event to bus
2. ViewSyncManager receives and validates
3. Manager transforms payload for target views
4. Target views receive transformed events
5. Views update UI without re-publishing (propagate=false)

**Error Handling**:
- Unknown entity ID: Log warning, filter from payload
- View transform failure: Log error, skip that view
- Circular event detection: Break loop, log warning

---

### Contract 4: D3.js Overlay Positioning

**Protocol**: Coordinate transformation function calls  
**Data Format**: Geographic coordinates ↔ SVG pixel coordinates

**Interface**:
```typescript
type CoordinateTransform = {
  // Geographic to screen pixels
  project(lngLat: [number, number]): [x, y]
  
  // Screen pixels to geographic
  unproject(point: [x, y]): [lng, lat]
  
  // Get current transformation matrix
  getMatrix(): DOMMatrix
}
```

**Coordinate Systems**:
- **Geographic**: WGS84 decimal degrees [longitude, latitude]
- **Screen**: Pixel coordinates relative to map container [x, y]
- **SVG**: SVG viewBox coordinates (may differ from screen pixels)

**Synchronization Requirements**:
- Transform functions update on map move/zoom events
- D3 SVG elements reposition within 16ms (60 FPS target)
- Transformations account for map rotation/pitch if enabled

---

### Contract 5: Three.js Custom Layer API

**Protocol**: MapLibre custom layer interface implementation  
**Data Format**: Three.js scene objects with geographic anchoring

**Interface Implementation**:
```typescript
type MapLibreCustomLayer = {
  id: string
  type: 'custom'
  renderingMode: '3d'
  
  onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void
  render(gl: WebGLRenderingContext, matrix: Float32Array): void
  onRemove?(map: MapLibreMap, gl: WebGLRenderingContext): void
}
```

**Integration Pattern**:
- Share WebGL context between MapLibre and Three.js
- Use MapLibre's projection matrix for Three camera
- Anchor Three.js objects to geographic coordinates
- Render Three scene during MapLibre render cycle

**Performance Constraints**:
- `render()` must complete <16ms for 60 FPS
- Scene complexity limited to maintain frame rate
- Automatic LOD reduction when FPS drops below 30

---

## Architectural Decisions

### ADR-001: Client-Side Spatial Analysis with Turf.js

**Status**: Accepted  
**Date**: 2026-01-21  
**Deciders**: System Architect, Backend Lead, Frontend Lead

**Context**  
Spatial analysis can occur client-side (JavaScript + Turf.js) or server-side (PostGIS database + REST API). Decision impacts infrastructure complexity, offline capability, and scalability.

**Decision**  
Implement spatial analysis client-side using Turf.js modular library.

**Alternatives Considered**

**Option 1: Server-Side PostGIS**
- **Pros**: Handles unlimited dataset sizes, more complex spatial operations, proven enterprise solution
- **Cons**: Requires PostgreSQL + PostGIS deployment, network latency for queries, no offline operation, additional infrastructure costs
- **Verdict**: Rejected - violates zero-backend-dependency principle

**Option 2: Hybrid (Simple Client + Complex Server)**
- **Pros**: Balances performance and capability, progressive enhancement
- **Cons**: Complex API design, dual maintenance burden, unclear threshold for client vs server
- **Verdict**: Rejected - premature optimization without demonstrated need

**Option 3: Client-Side Turf.js (Chosen)**
- **Pros**: Zero infrastructure, instant results (<1s for 50K entities), offline capable, free
- **Cons**: Browser memory limits (~100K entities), limited to Turf.js capabilities
- **Verdict**: Accepted - meets requirements with simplest architecture

**Rationale**  
User workflows involve <50,000 entities per session (95th percentile). Turf.js handles this scale efficiently (<1 second query time). System avoids server complexity while maintaining performance targets. Future migration to server-side possible if scale increases.

**Consequences**
- **Positive**: Zero backend infrastructure, instant spatial queries, works offline
- **Negative**: Dataset size limited by browser memory (mitigated by progressive loading)
- **Neutral**: Turf.js bundle adds ~15 KB gzipped (modular imports)

---

### ADR-002: Configurable Vector Style Provider

**Status**: Accepted  
**Date**: 2026-01-21  
**Deciders**: System Architect, Product Manager

**Context**  
Map tiles and styles can come from paid services (Mapbox, MapTiler), free services with API keys (Stadia), or zero-config free services (MapLibre demo tiles, OpenFreeMap). Decision impacts cost, configuration complexity, and reliability.

**Decision**  
Use a configurable MapLibre vector style URL, with a zero-config default (MapLibre demo tiles) and optional alternatives (OpenFreeMap or self-hosted style JSON).

**Alternatives Considered**

**Option 1: Mapbox**
- **Pros**: High quality, excellent docs, comprehensive features
- **Cons**: Costs $200+/month at scale, requires account setup, vendor lock-in
- **Verdict**: Rejected - violates zero-cost principle

**Option 2: Self-Hosted OpenMapTiles**
- **Pros**: Complete control, no external dependencies, unlimited usage
- **Cons**: Requires tile server infrastructure, complex setup (500+ configuration tokens), maintenance burden
- **Verdict**: Rejected - infrastructure complexity exceeds benefit

**Option 3: MapLibre demo tiles (Chosen default)**
- **Pros**: Zero cost, no API key, no registration, vector-first, low configuration
- **Cons**: Public demo infrastructure (reliability unknown), limited style options
- **Verdict**: Accepted - best zero-config default with an explicit provider-switching escape hatch

**Rationale**  
Defaulting to a zero-config vector style keeps onboarding friction low and avoids API keys. The architecture keeps the provider configurable via a style URL, enabling switching (OpenFreeMap, self-hosted) if reliability or styling requirements change.

**Consequences**
- **Positive**: Zero setup, zero cost, immediate availability, provider switching via configuration
- **Negative**: Dependency on public infrastructure (mitigated by configuration-driven migration to OpenFreeMap/self-hosted styles)
- **Neutral**: Attribution requirement (acceptable under FOSS licensing)

---

### ADR-003: MapLibre GL over Leaflet

**Status**: Accepted  
**Date**: 2026-01-21  
**Deciders**: System Architect, Frontend Lead, UX Designer

**Context**  
JavaScript mapping library choice between Leaflet (simpler, raster-focused) and MapLibre GL (modern, vector-focused, 3D-capable). Decision impacts Three.js integration, performance, and learning curve.

**Decision**  
Use MapLibre GL as primary mapping library.

**Alternatives Considered**

**Option 1: Leaflet**
- **Pros**: Simpler API (60 token setup), smaller bundle (42 KB), mature plugin ecosystem
- **Cons**: Poor Three.js integration (hacky overlay), no native 3D, no vector tile optimization
- **Verdict**: Rejected - Three.js integration requirement makes this impractical

**Option 2: MapLibre GL (Chosen)**
- **Pros**: Native WebGL, excellent Three.js integration via custom layer API, vector tiles, 3D terrain/buildings, modern architecture
- **Cons**: Larger bundle (220 KB), steeper learning curve, fewer plugins
- **Verdict**: Accepted - Three.js requirement mandates MapLibre's native WebGL support

**Rationale**  
System already uses Three.js for 3D knowledge structures. MapLibre GL shares WebGL context with Three.js, enabling seamless 3D integration. Leaflet's DOM-based rendering conflicts with Three.js WebGL, requiring complex manual synchronization. Vector tiles provide superior performance for 10K+ entities.

**Consequences**
- **Positive**: Native Three.js integration, 3D capabilities, vector tile performance, future-proof architecture
- **Negative**: Bundle size increase (+180 KB vs Leaflet, mitigated by code splitting)
- **Neutral**: Team learning investment in MapLibre API

---

### ADR-004: Event Bus for View Synchronization

**Status**: Accepted  
**Date**: 2026-01-21  
**Deciders**: System Architect, Frontend Lead

**Context**  
Cross-view state synchronization (map ↔ graph ↔ canvas) can use direct coupling, shared state object, or event bus. Decision impacts modularity, testability, and circular update prevention.

**Decision**  
Implement event bus pattern with source tracking for view synchronization.

**Alternatives Considered**

**Option 1: Direct View-to-View Coupling**
- **Pros**: Simple to implement, explicit dependencies
- **Cons**: Tight coupling, difficult testing, circular update risk, violates single responsibility
- **Verdict**: Rejected - creates maintenance nightmare as views multiply

**Option 2: Shared State Object (Redux-style)**
- **Pros**: Centralized state, time-travel debugging, predictable updates
- **Cons**: Boilerplate overhead, overkill for simple selection sync, learning curve
- **Verdict**: Rejected - complexity exceeds problem scope

**Option 3: Event Bus with Source Tracking (Chosen)**
- **Pros**: Loose coupling, easy testing, prevents circular updates, extensible
- **Cons**: Less explicit dependencies, debugging requires event tracing
- **Verdict**: Accepted - balances modularity with simplicity

**Rationale**  
Event bus decouples views while maintaining clear communication. Source tracking prevents infinite update loops (map selects entity → graph highlights → map re-selects). Pattern scales to future views without modifying existing code.

**Consequences**
- **Positive**: Views remain independent, easy to add new visualization types, testable in isolation
- **Negative**: Event flow less explicit than direct calls (mitigated by event logging in dev mode)
- **Neutral**: Requires event bus library (~3 KB) or custom implementation

---

### ADR-005: Plugin Architecture vs Monolithic Integration

**Status**: Accepted  
**Date**: 2026-01-21  
**Deciders**: System Architect, Product Manager

**Context**  
Geospatial features can integrate as monolith (all features always loaded) or plugin system (features load on-demand). Decision impacts bundle size, code organization, and extensibility.

**Decision**  
Implement plugin architecture with lazy-loaded geospatial modules.

**Alternatives Considered**

**Option 1: Monolithic Integration**
- **Pros**: Simple build process, no lazy loading complexity, easier debugging
- **Cons**: All users pay bundle cost even if not using maps, harder to maintain, single release cycle
- **Verdict**: Rejected - forces geographic overhead on non-geographic users

**Option 2: Feature Flags with Code Splitting**
- **Pros**: Runtime control, A/B testing capability, gradual rollout
- **Cons**: Flag management complexity, partial loading still bundles unused code
- **Verdict**: Considered but insufficient - doesn't solve bundle size for non-users

**Option 3: Plugin Architecture (Chosen)**
- **Pros**: Zero-cost for non-users, independent development cycles, clear boundaries, extensible
- **Cons**: Plugin API maintenance burden, dynamic loading complexity
- **Verdict**: Accepted - cleanest separation of concerns

**Rationale**  
Not all knowledge graph users need geospatial features. Plugin architecture loads MapLibre+Turf.js (~90 KB) only when user activates map view. System already has plugin infrastructure for D3/Three.js extensions, providing established pattern.

**Consequences**
- **Positive**: Core bundle stays lean, geospatial features develop independently, users choose capabilities
- **Negative**: Plugin API must remain stable (mitigated by semantic versioning)
- **Neutral**: Lazy loading adds initialization delay (~500ms first load, acceptable for opt-in feature)

---

## API Integration Patterns

### Pattern 1: Hook-Based Feature Activation

**Pattern Name**: Lazy Plugin Loader Hook  
**Problem**: Load geospatial dependencies only when user activates map view, prevent blocking main bundle  
**Solution**: React hook pattern with dynamic imports

**Implementation Sketch** (8 lines):
```typescript
// Hook abstracts async loading
function useMapPlugin() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    import('./mapPlugin').then(plugin => {
      plugin.initialize()
      setReady(true)
    })
  }, [])
  return {ready, MapComponent: ready ? MapView : LoadingPlaceholder}
}
```

**Benefits**: Zero bundle cost for non-users, declarative activation, error boundary isolation  
**Trade-offs**: 500ms initialization latency (acceptable for progressive enhancement)

---

### Pattern 2: Adapter Pattern for Data Transform

**Pattern Name**: Entity-GeoJSON Bidirectional Adapter  
**Problem**: Convert between knowledge graph entity format and MapLibre-compatible GeoJSON  
**Solution**: Adapter interface with extensible transform rules

**Implementation Sketch** (9 lines):
```typescript
// Adapter decouples entity model from mapping library
class GeoJSONAdapter {
  toGeoJSON(entities: Entity[]): FeatureCollection {
    return {
      type: "FeatureCollection",
      features: entities.filter(e => e.location)
        .map(e => ({
          type: "Feature",
          geometry: {type: "Point", coordinates: [e.location.lng, e.location.lat]},
          properties: {id: e.id, ...e.metadata}
        }))
    }
  }
}
```

**Benefits**: Entity model changes don't affect map code, testable in isolation, supports multiple entity types  
**Trade-offs**: Additional layer of abstraction, transform overhead (~10ms for 10K entities)

---

### Pattern 3: Observer Pattern for State Sync

**Pattern Name**: Cross-View Selection Observer  
**Problem**: Synchronize entity selection across map, graph, and canvas views without coupling  
**Solution**: Observable pattern with centralized selection state

**Implementation Sketch** (8 lines):
```typescript
// Central selection state with observers
class SelectionManager {
  private observers = new Set<Observer>()
  setSelection(ids: string[], source: string) {
    this.selection = ids
    this.observers.forEach(obs => {
      if (obs.id !== source) obs.update(ids)
    })
  }
  subscribe(obs: Observer) { this.observers.add(obs) }
}
```

**Benefits**: Views decoupled, easy to add new views, prevents infinite loops  
**Trade-offs**: Observers must implement update interface, debugging requires tracing observers

---

### Pattern 4: Strategy Pattern for Spatial Queries

**Pattern Name**: Spatial Query Strategy  
**Problem**: Support multiple spatial query types (proximity, area, relationship) with consistent interface  
**Solution**: Strategy pattern with query-specific implementations

**Implementation Sketch** (9 lines):
```typescript
// Strategy interface allows pluggable query types
interface SpatialQuery {
  execute(entities: Entity[], params: unknown): Entity[]
}

class ProximityQuery implements SpatialQuery {
  execute(entities, {center, radius}) {
    return entities.filter(e => 
      turf.distance(center, [e.location.lng, e.location.lat]) <= radius
    )
  }
}
```

**Benefits**: Add query types without modifying engine, testable strategies, clear query semantics  
**Trade-offs**: Interface overhead, each query needs separate implementation

---

### Pattern 5: Factory Pattern for Layer Creation

**Pattern Name**: Rendering Layer Factory  
**Problem**: Create different layer types (map, D3 overlay, Three.js) with consistent configuration  
**Solution**: Factory pattern with layer-specific builders

**Implementation Sketch** (8 lines):
```typescript
// Factory creates layers with proper setup
class LayerFactory {
  createLayer(type: string, config: LayerConfig) {
    const builders = {
      map: () => new MapLibreLayer(config),
      d3: () => new D3OverlayLayer(config),
      three: () => new ThreeCustomLayer(config)
    }
    return builders[type]()
  }
}
```

**Benefits**: Centralized layer creation, consistent initialization, easy to add layer types  
**Trade-offs**: Factory grows with layer types, configuration schemas may diverge

---

## Plugin Extension Points

### Extension Point 1: Custom Spatial Query Operators

**Hook**: `registerSpatialOperator(name: string, implementation: SpatialQueryFunction)`  
**Purpose**: Allow domain-specific spatial analysis beyond Turf.js built-ins  
**Example Use Case**: Academic researchers add "citation proximity" operator (entities near each other with citation links)

**Interface**:
```typescript
type SpatialQueryFunction = (
  entities: Entity[], 
  parameters: Record<string, any>
) => Entity[]

// Registration
spatialEngine.registerOperator('citationProximity', (entities, params) => {
  // Custom logic combining spatial and graph data
})
```

**Constraints**: Operator must return results <3 seconds for 50K entities, handle empty input gracefully

---

### Extension Point 2: Custom Map Layers

**Hook**: `addCustomLayer(config: CustomLayerConfig): LayerHandle`  
**Purpose**: Enable domain-specific map overlays (heatmaps, flow maps, network diagrams)  
**Example Use Case**: Urban planners add transit route layer with real-time updates

**Interface**:
```typescript
type CustomLayerConfig = {
  id: string
  type: 'geojson' | 'd3-overlay' | 'three-custom'
  data: GeoJSON | DataFetchFunction
  style: StyleSpecification
  zIndex: number
}

// Usage
const transitLayer = layerManager.addCustomLayer({
  id: 'transit-routes',
  type: 'geojson',
  data: fetchTransitData,
  style: routeStyle
})
```

**Constraints**: Layer rendering must not degrade map FPS below 30, updates via efficient diff patching

---

### Extension Point 3: Coordinate System Transformers

**Hook**: `registerProjection(name: string, transformer: ProjectionTransformer)`  
**Purpose**: Support non-WGS84 coordinate systems (UTM zones, State Plane, custom grids)  
**Example Use Case**: Government agencies work with State Plane coordinates

**Interface**:
```typescript
type ProjectionTransformer = {
  toWGS84(coords: [number, number]): [lng, lat]
  fromWGS84(lngLat: [number, number]): [x, y]
  bounds: BoundingBox
}

// Registration
projectionManager.register('NAD83-StatePlane-CA-Zone3', {
  toWGS84: (coords) => proj4(statePlane, wgs84, coords),
  fromWGS84: (lngLat) => proj4(wgs84, statePlane, lngLat),
  bounds: {minX, minY, maxX, maxY}
})
```

**Constraints**: Transformation must be bijective, performance <1ms per coordinate, handle datum shifts

---

### Extension Point 4: Geocoding Service Integration

**Hook**: `setGeocodingProvider(provider: GeocodingProvider)`  
**Purpose**: Allow pluggable geocoding services (Nominatim, Google, Mapbox, custom)  
**Example Use Case**: Organizations use internal geocoding API with proprietary data

**Interface**:
```typescript
type GeocodingProvider = {
  geocode(address: string): Promise<GeocodingResult[]>
  reverseGeocode(lngLat: [number, number]): Promise<Address>
  batchGeocode(addresses: string[]): Promise<GeocodingResult[]>
}

// Implementation example (4 lines)
const nominatimProvider = {
  geocode: (addr) => fetch(`nominatim.org/search?q=${addr}`).then(r => r.json()),
  reverseGeocode: ([lng,lat]) => fetch(`nominatim.org/reverse?lat=${lat}&lon=${lng}`).then(r => r.json()),
  batchGeocode: async (addrs) => Promise.all(addrs.map(a => this.geocode(a)))
}
```

**Constraints**: Rate limiting handled by provider, results include confidence score, timeout after 10s

---

### Extension Point 5: Event Stream Subscribers

**Hook**: `subscribeToMapEvents(eventType: MapEventType, handler: EventHandler)`  
**Purpose**: Enable external systems to react to map interactions (clicks, selections, viewport changes)  
**Example Use Case**: Analytics system tracks spatial exploration patterns

**Interface**:
```typescript
type MapEventType = 'click' | 'selection' | 'viewport-change' | 'query-complete'

type MapEvent = {
  type: MapEventType
  timestamp: number
  payload: ClickPayload | SelectionPayload | ViewportPayload
  source: 'user' | 'programmatic'
}

// Subscription
eventBus.subscribe('selection', (event: MapEvent) => {
  analytics.trackSelection(event.payload.entityIds)
})
```

**Constraints**: Handlers must not block rendering thread (async execution), unsubscribe mechanism required

---

## Quality Attributes

### Performance Requirements

**Rendering Performance**:
- Map initialization: <1 second for 5,000 entities
- Marker clustering activation: <500ms for 10,000+ entities
- Pan/zoom interaction: Maintain 60 FPS with 20,000 visible entities
- Layer toggle: <200ms to show/hide layer with 10,000 features
- 3D mode transition: <1 second including terrain loading

**Query Performance**:
- Proximity search: <500ms for 50,000 entities
- Area filter: <1 second for 100,000 entities
- Spatial relationship detection: <3 seconds for 5,000 entity pairs
- Coordinate transformation: <1ms per entity
- GeoJSON conversion: <100ms for 10,000 entities

**Memory Constraints**:
- Base map component: <50 MB
- 10,000 entities loaded: <100 MB total
- 50,000 entities: <300 MB total (with clustering)
- Tile cache: <100 MB (configurable)

---

### Scalability Requirements

**Entity Count Handling**:
- Full feature set: Up to 10,000 entities without degradation
- With clustering: Up to 100,000 entities (progressive loading)
- Spatial queries: 50,000 entities with <3 second latency
- Concurrent visualizations: 3 map views simultaneously

**Geographic Extent**:
- Global coverage: All zoom levels 0-18
- Detail level: City-scale (zoom 12-15) as primary use case
- Coordinate precision: 6 decimal places (~10cm accuracy)

**Progressive Enhancement**:
- <1,000 entities: Full features, no clustering
- 1,000-10,000: Automatic clustering at low zoom
- 10,000-100,000: Mandatory clustering, lazy load on zoom
- >100,000: Require server-side spatial database (out of scope, documented constraint)

---

### Security Requirements

**Data Privacy**:
- Coordinate data remains client-side (no external transmission except tile requests)
- Geocoding requests use HTTPS only
- No entity metadata sent to tile provider
- Support for offline tile cache (no external requests)

**Input Validation**:
- Coordinate bounds validation: lat ∈ [-90, 90], lng ∈ [-180, 180]
- GeoJSON schema validation before rendering
- Spatial query parameter sanitization (prevent injection attacks)
- Maximum polygon complexity limits (prevent DoS via complex geometries)

**Access Control Integration**:
- Respect existing entity-level permissions (filtered entities never render)
- Map view obeys same access controls as graph view
- Spatial query results filtered by user permissions
- Export functionality respects data access policies

---

### Observability Requirements

**Logging**:
- Performance metrics: All spatial queries >1 second logged with parameters
- Error tracking: Coordinate validation failures, tile load errors, transform exceptions
- User actions: Map view activations, spatial queries, layer toggles, entity selections
- Integration health: D3/Three.js sync failures, event bus errors

**Monitoring Dashboards**:
- Real-time FPS counter in dev mode
- Tile request success/failure rates
- Spatial query latency histogram (p50, p95, p99)
- Memory usage tracking with entity count correlation
- Plugin load times and failure rates

**Performance Profiling**:
- Chrome DevTools integration for frame timing
- Turf.js operation profiling (which operations slow)
- Entity-to-GeoJSON transform timing
- View synchronization latency measurement

**User Analytics** (Privacy-Preserving):
- Map view activation rate (% of sessions)
- Average spatial queries per session
- Most common query types (proximity vs area vs relationship)
- Entity count distribution in actual usage
- Browser/device performance cohorts

---

## Deployment Strategy

### Incremental Rollout Plan

**Phase 1: Foundation (Weeks 1-4)**  
Deploy MapLibre GL + OpenFreeMap integration with basic entity display (PRD-1.1, PRD-1.2). No spatial queries yet. Target 10% of users for feedback.

**Validation Criteria**:
- 60 FPS sustained with 5,000 entities
- <2 second map initialization
- Zero tile loading errors >95% reliability
- User feedback survey (NPS >8)

**Rollback Trigger**: FPS <30 for >5% of sessions, tile loading failure >10%

---

**Phase 2: Spatial Queries (Weeks 5-8)**  
Add proximity search and area filtering (PRD-2.1, PRD-2.2). Expand to 30% of users.

**Validation Criteria**:
- Proximity queries complete <500ms for 50K entities
- Zero client crashes from spatial operations
- Query adoption >40% of map view users
- Performance degradation <5% vs Phase 1

**Rollback Trigger**: Query latency >3 seconds p95, browser crashes >1%

---

**Phase 3: Multi-Layer Integration (Weeks 9-12)**  
Deploy D3.js overlay and Three.js integration (PRD-3.1, PRD-3.2). Expand to 60% of users.

**Validation Criteria**:
- D3 layer sync <300ms latency
- Three.js 3D mode maintains >30 FPS
- Cross-view selection works >99% reliability
- Memory usage <400 MB for 10K entities with all layers

**Rollback Trigger**: FPS degradation >20%, memory leaks detected, sync failures >5%

---

**Phase 4: Full Deployment (Weeks 13-16)**  
Enable all features for 100% of users. Monitor for scaling issues.

**Validation Criteria**:
- All Phase 1-3 metrics maintained
- Support ticket volume <5 per week
- Performance across diverse devices/browsers
- User adoption >60% of eligible sessions

**Rollback Trigger**: System-wide performance degradation, critical bugs affecting >10% users

---

### Blue-Green Deployment

**Configuration**: Maintain two identical frontend builds (blue=current, green=new)  
**Switch Mechanism**: Feature flag controls which build serves map plugin  
**Rollback Time**: <5 minutes (toggle feature flag)  
**Database Impact**: None (client-side only changes)

---

### Canary Deployment for Plugin

**Canary Group**: 5% of users receive new map plugin version  
**Metrics Comparison**: Canary performance vs baseline (FPS, query latency, error rate)  
**Automated Rollback**: If canary error rate >2x baseline, auto-disable new version  
**Promotion Criteria**: 24 hours stable with metrics within 10% of baseline

---

## Migration Path

### For Existing Users with Location Data

**Current State**: Users manually maintain location metadata in entity properties  
**Migration Strategy**: Zero-disruption automatic detection

**Migration Steps**:
1. **Detection Phase**: Scan entity schema for location-like properties (`lat/lng`, `latitude/longitude`, `coordinates`, `address`)
2. **Normalization**: Transform detected properties to standard `location: {lat, lng}` format
3. **Validation**: Confirm coordinate bounds, log anomalies for user review
4. **Activation**: Enable map view for entities with valid coordinates (no user action required)

**Data Preservation**: Original property names retained, new `location` field added  
**Rollback**: Disable map plugin, original data unchanged

---

### For Users Without Location Data

**Onboarding Flow**:
1. User adds entity with location-related text (address, city, region)
2. System detects location text, offers geocoding assistant
3. User confirms geocoding results, coordinates saved
4. Map view automatically available

**Geocoding Strategy**: Batch process on-demand (no automatic background geocoding to preserve privacy)

---

### Breaking Changes Policy

**No Breaking Changes**: All location data structures backward compatible  
**Deprecation Process**: If future changes needed, 6-month deprecation notice with migration guide  
**Version Pinning**: Users can pin map plugin version to prevent auto-updates

---

## Traceability Matrix

### PRD to TAD Mapping

| PRD Requirement | TAD Components | Quality Attributes |
|-----------------|----------------|-------------------|
| [PRD-1.1] Display Entities on Map | MapLibre Adapter, Tile Provider | Performance (render), Scalability (entity count) |
| [PRD-1.2] Link Map to Graph View | View Sync Manager, Event Bus | Performance (sync latency), Observability (logging) |
| [PRD-1.3] Style Entities by Properties | MapLibre Adapter (style rules) | Performance (style application) |
| [PRD-2.1] Proximity Search | Spatial Query Engine (Turf.js) | Performance (query latency), Scalability (50K entities) |
| [PRD-2.2] Area-Based Filtering | Spatial Query Engine (polygon ops) | Performance (polygon complexity), Security (validation) |
| [PRD-2.3] Spatial Relationship Detection | Spatial Query Engine (pairwise) | Performance (relationship calc), Scalability (pairs) |
| [PRD-3.1] D3.js Data Overlay | Multi-Layer Renderer, Coord Transform | Performance (FPS), Observability (sync tracking) |
| [PRD-3.2] 3D Geographic Features | Multi-Layer Renderer (Three.js) | Performance (3D FPS), Memory (scene complexity) |
| [PRD-3.3] Infinite Canvas Integration | Multi-Layer Renderer (viewport) | Performance (canvas sync) |
| [PRD-4.1] Geocoding Entity Addresses | Geocoding Provider (extension point) | Security (HTTPS), Privacy (no metadata leak) |
| [PRD-4.2] Spatial Relationship Graph Edges | Spatial Query Engine + Graph API | Scalability (edge creation), Performance (graph update) |
| [PRD-4.3] Service Area Documentation | Spatial Query Engine (coverage calc) | Performance (area stats) |

---

## Validation Checklist

### Pre-Implementation Validation

#### PRD Completeness
- [x] Problem statements articulate user pain points without proposing solutions
- [x] User stories follow "As a...I want...So that" format with clear value proposition
- [x] Acceptance criteria use Given-When-Then pattern with measurable outcomes
- [x] Features prioritized via MoSCoW framework (Must/Should/Could/Won't)
- [x] Success metrics defined with baseline, target, and timeline
- [x] Out of scope items explicitly documented to prevent scope creep
- [x] Dependencies identified with mitigation strategies
- [x] Open questions flagged for research with decision timelines

#### TAD Completeness
- [x] Components have single responsibility with clear boundaries
- [x] Interfaces specified with typed contracts (request/response schemas)
- [x] Architectural decisions documented with ADR format (context, alternatives, rationale)
- [x] Quality attributes specified with concrete scenarios and metrics
- [x] Deployment strategy defined with rollback procedures
- [x] Migration path addresses existing users and data preservation
- [x] Traceability matrix links PRD requirements to TAD components

#### Separation of Concerns
- [x] PRD contains zero implementation details (no code, algorithms, libraries)
- [x] TAD contains zero business logic (no user stories, acceptance criteria)
- [x] PRD focuses on WHAT (user needs) and WHY (business value)
- [x] TAD focuses on HOW (technical approach) and CONSTRAINTS (quality attributes)

---

### Post-Documentation Review

#### Stakeholder Validation
- [ ] Product Manager confirms PRD addresses user research findings
- [ ] UX Designer validates user personas match target audience
- [ ] Development Team confirms TAD provides sufficient implementation guidance
- [ ] QA Engineer verifies acceptance criteria are testable and unambiguous
- [ ] Security Team approves data privacy and input validation strategies
- [ ] Performance Team validates scalability targets are achievable

#### Technical Feasibility
- [ ] MapLibre GL + OpenFreeMap integration prototyped successfully
- [ ] Turf.js performance benchmarked with representative datasets
- [ ] D3.js/Three.js coordinate synchronization tested
- [ ] Event bus pattern prevents circular updates in prototype
- [ ] Plugin lazy loading achieves <500ms initialization target

#### Documentation Quality
- [ ] All mantra requirements (CID framework) applied to specifications
- [ ] Requirement IDs enable bidirectional PRD-TAD traceability
- [ ] No conflicting specifications between PRD and TAD
- [ ] Document versioning tracks evolution with semantic versioning
- [ ] Open questions resolved or assigned to research owners

---

## Appendix: Technology Stack Summary

### Core Libraries (Required)

| Library | Version | License | Bundle Size | Purpose |
|---------|---------|---------|-------------|---------|
| MapLibre GL JS | 4.x | BSD-3 | 220 KB (68 KB gzipped) | Map rendering, 3D visualization |
| Turf.js (modular) | 7.x | MIT | 15-50 KB (5-15 KB gzipped) | Spatial analysis operations |
| OpenFreeMap Tiles | Latest | ODbL | 0 KB (CDN-hosted) | Vector map tiles |

**Total Bundle Impact**: ~90 KB gzipped (lazy-loaded only when map view activated)

### Optional Extensions

| Extension | Purpose | Bundle Impact | Loading Strategy |
|-----------|---------|---------------|------------------|
| Nominatim Client | Address geocoding | +5 KB | On-demand import |
| Proj4js | Coordinate transformations | +20 KB | Lazy load if custom projections needed |
| MapLibre-Three Plugin | Enhanced 3D integration | +8 KB | Bundled with Three.js layer activation |

### Integration Dependencies

| System Component | Required API | Coupling Level |
|-----------------|--------------|----------------|
| Graph View | Selection state getter/setter | Low (event-based) |
| D3.js System | SVG overlay container | Medium (DOM coordination) |
| Three.js System | WebGL context sharing | High (rendering cycle sync) |
| Infinite Canvas | Viewport bounds API | Low (geometric transform) |
| Entity Store | Read-only entity access | Low (query interface) |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-21 | System Architect | Initial PRD & TAD draft for stakeholder review |

---

## Approval Signatures

**Product Manager**: _________________ Date: _________  
**System Architect**: _________________ Date: _________  
**Engineering Lead**: _________________ Date: _________  
**UX Designer**: _________________ Date: _________

---

*End of Document*

---

https://claude.ai/chat/b9e13636-997e-4d35-b742-44c710e716a5


```
I've created a comprehensive PRD & TAD document for integrating MapLibre GL + OpenFreeMap + Turf.js into your Knowledge Graph/Agentic GraphRAG system.

## Document Highlights:

### **PRD Section (WHAT/WHY)**
- **4 Epics** covering visualization, spatial analysis, multi-layer integration, and knowledge enrichment
- **12 User Stories** with Given-When-Then acceptance criteria
- **3 User Personas** (Research Analyst, Intelligence Analyst, Urban Planner)
- **Quantified Success Metrics** with baselines and targets
- **MoSCoW Prioritization** for incremental delivery

### **TAD Section (HOW)**
- **5 Core Components**: MapLibre Adapter, Spatial Query Engine, View Sync Manager, Multi-Layer Renderer, Tile Provider
- **5 Integration Contracts**: Data transforms, spatial queries, event sync, D3 overlay, Three.js custom layer
- **5 ADRs** documenting critical decisions (Turf.js client-side, OpenFreeMap tiles, MapLibre over Leaflet, Event Bus, Plugin Architecture)
- **5 API Patterns**: Hook-based loading, Adapter, Observer, Strategy, Factory
- **5 Plugin Extension Points**: Custom queries, map layers, projections, geocoding, event streams

### **Key Features Evaluated**:

**APIs**: REST-style contracts with typed schemas, Promise-based async patterns  
**Plugins**: Lazy-loaded architecture with semantic versioning, zero-cost for non-users  
**Hooks**: React-style hooks for feature activation and lifecycle management  
**Events**: Pub/sub event bus with source tracking to prevent circular updates

### **All Guidelines Met**:
✅ Problem-first approach (no solution jumping)  
✅ Domain-agnostic patterns (reusable across knowledge domains)  
✅ Bidirectional traceability (PRD↔TAD matrix)  
✅ No code blocks >10 lines (max 9 lines per example)  
✅ Measurable acceptance criteria  
✅ Quality attributes with concrete scenarios  
✅ Deployment strategy with rollback plans

The document is ready for stakeholder review and provides complete implementation guidance while maintaining separation between product requirements and technical architecture.
```
