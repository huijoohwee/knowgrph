## 1. Architecture design

```mermaid
graph TD
  A[User Browser] --> B[React Frontend Application]
  B --> C[File System API]
  C --> D[JSON-LD Parser]
  D --> E[Graph Renderer]
  E --> F[Force Simulation Engine]

  subgraph "Frontend Layer"
      B
      C
      D
      E
      F
  end
```

## 2. Technology Description
- Frontend: React@18 + D3.js@7 + Vite
- Initialization Tool: vite-init
- Backend: None (client-side only)
- File Handling: Browser File System Access API

## 3. Route definitions
| Route | Purpose |
|-------|---------|
| /canvas | Main graph visualization and editing interface |

## 4. API definitions

### 4.1 File Operations
```
File System Access API
```

Request:
| Param Name| Param Type  | isRequired  | Description |
|-----------|-------------|-------------|-------------|
| fileHandle| FileSystemFileHandle | true | Browser file handle for read/write operations |

Response:
| Param Name| Param Type  | Description |
|-----------|-------------|-------------|
| content   | string      | JSON-LD graph data |
| success   | boolean     | Operation status |

## 5. Data model

### 5.1 Data model definition
```mermaid
erDiagram
  GRAPH ||--o{ NODE : contains
  GRAPH ||--o{ EDGE : contains
  NODE ||--o{ PROPERTY : has
  EDGE ||--o{ PROPERTY : has

  GRAPH {
      string id PK
      string context
      string type
  }
  NODE {
      string id PK
      string label
      string type
      number x
      number y
  }
  EDGE {
      string id PK
      string source
      string target
      string label
  }
  PROPERTY {
      string key
      string value
  }
```

### 5.2 Data Definition Language
Graph Node Collection
```typescript
interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  properties: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties: Record<string, any>;
}

interface GraphData {
  context: string;
  type: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```