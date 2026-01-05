I will create the `knowgrph-workflow-catalog.md` file to document the end-to-end workflow from **Load Data** to **Render Knowledge Graph**.

The content will be structured as a table with the following columns, matching the style of the settings catalog:
- **Phase**: The high-level stage (Data Loading, Parsing, State, Rendering).
- **Step**: The specific action.
- **Responsibility**: What the step achieves.
- **Modules**: The files involved.
- **Functions/Methods**: Key functions executed.
- **Input/Output**: Data flow.
- **Notes**: Additional context.

### Proposed Content for `knowgrph-workflow-catalog.md`

```markdown
# Knowgrph Workflow Catalog

| Phase | Step | Responsibility | Modules | Functions/Methods | Input | Output | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Data Loading** | User Trigger | Initiate load via Toolbar | `canvas/src/components/Toolbar.tsx` | `handleLoad` | User Click | `loadDataViaParser()` | Dynamically imports loader logic |
| **Data Loading** | File Selection | Prompt user for file | `canvas/src/features/parsers/loader.ts`, `canvas/src/lib/graph/file.ts` | `pickTextFile` | — | `File` { name, text } | Browser native file picker |
| **Parsing** | Parser Selection | Identify format by extension/content | `canvas/src/features/parsers/loader.ts`, `canvas/src/features/parsers/registry.ts`, `canvas/src/features/parsers/default.ts` | `bestMatch` | `name`, `text` | `ParserSpec` (e.g., CSV, JSON) | Matches `csv`, `jsonld`, `n8n`, `python`, `graphrag` |
| **Parsing** | Parse Execution | Transform text to GraphData | `canvas/src/features/parsers/registry.ts`, `canvas/src/lib/graph/csv.ts`, `canvas/src/lib/graph/rawToGraph.ts` | `applyParserAsync` | `text` | `GraphData` { nodes, edges } | Async wrapper handles worker delegation if needed |
| **State** | Store Update | Commit data to global state | `canvas/src/features/parsers/loader.ts`, `canvas/src/hooks/store/graphDataSlice.ts` | `setData` | `GraphData` | Store State Update | Resets minimap; schedules history snapshot |
| **Rendering** | Initialization | Initialize D3 simulation & zoom | `canvas/src/components/GraphCanvas.tsx`, `canvas/src/components/GraphCanvas/simulation.ts` | `useEffect`, `buildSimulation` | `data` (store) | `d3.forceSimulation` | Sets forces (charge, link, collision) |
| **Rendering** | Element Creation | Bind data to SVG elements | `canvas/src/components/GraphCanvas.tsx` | `useEffect` | `data.nodes`, `data.edges` | SVG DOM (`circle`, `line`) | Applies schema styles (color, radius) |
| **Rendering** | Animation | Update positions per tick | `canvas/src/components/GraphCanvas.tsx` | `simulation.on('tick')` | Simulation coords | DOM Attributes | Animates layout until alpha decay |
```