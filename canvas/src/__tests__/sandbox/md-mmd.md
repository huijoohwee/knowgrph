**parser template** that reads a `mermaid:` block from YAML frontmatter and renders it automatically. The idea is:  

1. Parse Markdown frontmatter.  
2. Extract the `mermaid` key (multiline string).  
3. Pass that string to Mermaid.js for rendering.  

---

## Example Markdown Input

```markdown
---
title: "Analytics Overview"
mermaid: |
  graph TD
    A[Data] --> B[Visualization]
    B --> C[Informs]
---

# Analytics Overview

Narrative text here.
```

---

## ✅ What Happens

- The parser reads the frontmatter.  
- Finds the `mermaid:` block.  
- Passes its contents (`graph TD …`) to Mermaid.js.  
- Renders in d3 knowledge graph canvas.  