## 1.Architecture design
```mermaid
graph TD
  A["User Browser"] --> B["React UI (Vite App Shell)"]
  B --> C["React Router (Base-Path Aware)"]
  B --> D["State Store (Zustand)"]
  B --> E["Local Database (RxDB / IndexedDB)"]
  B --> F["Rendering Engines (Canvas/D3/Mermaid/Monaco)"]

  subgraph "Frontend Layer"
    B
    C
    D
    F
  end

  subgraph "Local Data Layer"
    E
  end

  subgraph "Hosting (Static)"
    G["Local Dev Server"]
    H["Deployed Static Site (GitHub Pages)"]
  end

  G --> B
  H --> B
```

## 2.Technology Description
- Frontend: React@18 + react-router-dom@7 + vite@6
- Styling: tailwindcss@3 (plus centralized design tokens/constants)
- State: zustand@5
- Local persistence: rxdb@16 (IndexedDB)
- Editors/visualization: monaco-editor, d3, mermaid, three (existing)
- Backend: None

## 3.Route definitions
| Route | Purpose |
|-------|---------|
| / | Entry route; redirects to primary workspace (base-path aware) |
| /canvas | Main Canvas Workspace (toolbar/sidebar/bottom panel) |
| /docs | Docs / workflow preview content in app shell |
| /settings | UI preferences and SSOT token diagnostics |

## 6.Data model(if applicable)
### 6.1 Data model definition
Client-side (RxDB) collections should remain stable while UI responsiveness changes.

```mermaid
erDiagram
  KG_DOCUMENT {
    string id
    string title
    string sourceType
    string contentRef
    string updatedAt
  }
  KG_GRAPH {
    string id
    string name
    string dataRef
    string updatedAt
  }
  KG_UI_PREFERENCE {
    string id
    string density
    string theme
    string updatedAt
  }

  KG_DOCUMENT ||--o{ KG_GRAPH : "renders_from"
  KG_UI_PREFERENCE ||--o{ KG_GRAPH : "affects_view"
```

### 6.2 Data Definition Language
Not applicable (no server database).