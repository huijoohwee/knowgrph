# Agentic RAG Demo

This document describes the "Demo" functionality available in the KnowGrph Canvas toolbar.

## Functionality

The "Demo" button allows users to quickly experience the Agentic RAG pipeline without needing to manually import files or configure settings.

### Workflow

1.  **Load Sample Data**: The system loads the **AI Engineering Field Guide (Version 4.0)** content into the workspace.
    *   Content covers Fundamentals (Python, SQL), Machine Learning (Scikit-learn), Deep Learning (TensorFlow, PyTorch), Ethics, and Practice.
2.  **Client-Side Pipeline Execution**: The `AgenticRagPipeline` runs entirely in the browser.
    *   **Token Linking**: Identifies entities and tracks provenance (line numbers).
    *   **Edge Elevation**: Extracts relationships with confidence scores.
    *   **Threshold Tuning**: Dynamically adjusts parameters based on text characteristics.
3.  **Graph Visualization**: The extracted graph is immediately rendered in the canvas.
    *   Nodes represent entities.
    *   Edges represent extracted relationships.
    *   Metrics (e.g., entity density) are calculated and stored in metadata.

## Usage

1.  Open the Toolbar menu (click the "Floating Panel" or status icon in the top-left).
2.  Click the **Demo** button (MonitorPlay icon) in the "Workspace Actions" section.
3.  Observe the status change to "Running Agentic RAG...".
4.  Once complete, the "Curation" panel will open, displaying the generated graph.

## Technical Details

*   **Entry Point**: `handleRunDemo` in `ToolbarMenuLauncher.tsx`.
*   **Implementation**: `runAgenticRagDemo` in `src/__tests__/demo/runner.ts`.
*   **Data Ingestion**: `src/features/parsers/html-parser.ts` converts HTML to Markdown, handling collapsed sections (`<details>`) and extracting JSON-LD.
*   **Data Source**: `src/__tests__/demo/data.ts` (HTML content mirroring the neutral AI Engineering Field Guide).
*   **Pipeline**: Uses `AgenticRagPipeline` from `@/features/agentic-rag`.
*   **Configuration**: Uses `DEFAULT_AGENTIC_RAG_CONFIG`.
