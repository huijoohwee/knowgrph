---
title: "Agentic GraphRAG Full Test Diagram"
author: "h3"
tags: [GraphRAG, Agentic, Test]
date: 2026-01-09
mermaidAnchorsOnly: true
mermaid: |
  graph TD
    %% Core pipeline
    Input[User Query] --> Retrieval[Context Retrieval]
    Retrieval --> Augmentation[Graph Augmentation]
    Augmentation --> Generation[Answer Generation]
    Generation --> Output[Final Response]

    %% Agents hierarchy
    Root[GraphRAG System]
    Root --> AgentNode[Agent]
    AgentNode --> TaskNode[Task]
    TaskNode --> ArtifactNode[Artifact]
    ArtifactNode --> MemoryNode[Graph Memory]

    %% Decision branching
    Decision[Agent Decision] -->|Context Found| PathA[Use GraphRAG]
    Decision -->|Context Missing| PathB[Fallback to LLM]

    %% Feedback loop
    Generation --> Evaluation[Evaluator]
    Evaluation -->|Refine| Retrieval
    ArtifactNode --- MemoryNode

    %% Click binding to Markdown anchors
    click AgentNode "#agent" "Go to Agent section"
    click TaskNode "#task" "Go to Task section"
    click ArtifactNode "#artifact" "Go to Artifact section"
---

# Agentic GraphRAG Full Test

This file demonstrates **CommonMark + Mermaid integration** with anchors and links.

---

## Core Pipeline
- Input → Retrieval → Augmentation → Generation → Output

---

## 🔑 Mapping Strategy

- **Nodes (labels):** `"User Query"`, `"Context Retrieval"`, etc. → defined in Mermaid as `Input[User Query]`, `Retrieval[Context Retrieval]`.
- **Edges:** `"Retrieval"`, `"Augmentation"`, etc. → defined in Mermaid with arrows (`-->`).
- **Graph Layers:** `"Core pipeline"`, `"Agents hierarchy"`, etc. → represented with `%% comments` or `subgraph` blocks in Mermaid.
- **Anchors:** `<a id="agent"></a>` in Markdown body → target for Mermaid `click AgentNode "#agent"`.
- **Links:** `[Agents](#agent)` in tables or lists → clickable references to anchors.

---

## ✅ How It Works

- Mermaid defines nodes (`AgentNode`, `TaskNode`, `ArtifactNode`) with **click bindings** to anchors.  
- Markdown body defines anchors (`<a id="agent">`) under headings.  
- Table cells link to those anchors (`[Agents](#agent)`), creating a consistent loop:  
  - Click node in diagram → jump to section.  
  - Click table link → jump to section.  

---

## Agents Hierarchy
<a id="agent"></a>
### Agent
Agent performs tasks and collaborates with Generator/Evaluator.

<a id="task"></a>
### Task
Tasks fetch context or compose answers.

<a id="artifact"></a>
### Artifact
Artifacts are outputs stored in memory.

---

##### Table Linking Anchors

| Component | Role                  | Example Node |
|-----------|-----------------------|--------------|
| [Agents](#agent)   | Responsibilities       | Retriever, Generator |
| [Tasks](#task)     | Operations             | Fetch, Compose       |
| [Artifacts](#artifact) | Produced outputs      | Stored in Memory     |

---

## Lists & Emphasis
- *Italic*, **Bold**, ~~Strike~~, `inline code`
1. Ordered item  
2. Nested list  
   - Sub item

---

## Links & Images
- [Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement)  
- ![Placeholder](https://via.placeholder.com/100 "Alt")

---

## Blockquote & Code
> Example blockquote with context.

```json
{ "example": "JSON block" }
```

```bash
echo "Hello GraphRAG"
```
