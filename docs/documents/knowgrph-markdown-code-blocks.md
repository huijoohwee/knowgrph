# Markdown Code Blocks & Token Sharing

## Overview
The Markdown rendering engine in Knowgrph has been enhanced to support GitHub-style code blocks with semantic HTML structure and optimized token sharing architecture. This ensures high performance during rendering cycles and a consistent, accessible UI.

## Features

### GitHub-Style UI
Code blocks now feature a structured layout matching GitHub's design system:
- **Header Bar**: A distinct header (`<header>`) containing metadata and controls.
- **Language Label**: Clearly visible language identifier (e.g., YAML, TSX).
- **Copy Button**: Integrated clipboard copy functionality with visual feedback.
- **View Toggles**: "Beside" and "Inline" toggle buttons for annotation views:
  - **Inline**: Renders annotations above the code block.
  - **Beside**: Renders code on the left and annotations on the right (on desktop), or annotations above code (on mobile).
- **Hover Effects**: The entire code block (including annotations in Beside/Inline modes) is highlighted with a blue border on hover, ensuring clear visual grouping of the code and its associated notes.

### Semantic HTML
The implementation replaces generic `<div>` wrappers with semantic elements:
- `<figure>`: The main container for the code block.
- `<header>`: Container for the top bar controls.
- `<pre>` & `<code>`: Standard elements for code content.
- `<span>` & `<button>`: For labels and interactive elements.

### Syntax Highlighting
- Powered by `highlight.js`.
- Supports Light (GitHub-like) and Dark (GitHub Dark-like) themes.
- Theme tokens are centralized in `UI_THEME_TOKENS`.
- **Line Highlighting**: Supports highlighting specific lines using `{1-3,5}` syntax in the language info string (e.g., `ts {1-3}`).
- **Mermaid Support**: Standard `mermaid` and `mmd` blocks are rendered as interactive diagrams using the Mermaid library. `textmermaid` is treated as a standard code block.

## Architecture & Performance

### Token Sharing
To avoid redundant processing and ensure consistency across the application (e.g., between Canvas, Preview, and Slides):
- **Shared Lexing**: Markdown content is lexed once using `markdownPreviewLex.ts`.
- **Token Passing**: The resulting tokens (`TokenWithLines`) are passed directly to `MarkdownCodeBlock`.
- **No Re-lexing**: The component consumes the pre-computed token, avoiding expensive re-parsing during render cycles.

### Rendering Optimization
- **Memoization**: `MarkdownCodeBlock` is wrapped in `React.memo` to prevent unnecessary re-renders when parent components update.
- **Highlight Caching**: Syntax highlighting is memoized via `useMemo`, ensuring that `highlight.js` is only invoked when the code content or language changes.

## Usage

```markdown
```yaml
name: Example Workflow
on: push
jobs:
  build:
    runs-on: ubuntu-latest
```
```

The above markdown will be rendered with the enhanced code block UI automatically.

## Annotation & Stable Identifiers
To support robust annotations even when code block content or position changes, the system supports stable identifiers in the code block info string:

```markdown
```js {id:my-stable-block-id}
console.log('hello')
```
```

The parsed `id` is used as the key for looking up annotations, falling back to line-based keys only when no ID is present. This ensures annotations persist through refactors.
