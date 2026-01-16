# Bottom Panel Markdown Features

## Overview
This document outlines the features and behaviors of the Markdown Viewer, Editor, and Presentation modes in the Bottom Panel.

## Features

### 1. Sticky Headings
- **Behavior**: Heading elements (H1-H6) in the Markdown Viewer stick to the top of the viewport when scrolling.
- **Styling**: Uses `sticky top-0` with a backdrop blur (`bg-white/95 backdrop-blur-sm`) to ensure readability over scrolling content.
- **Editor**: The Monaco Editor also enables `stickyScroll` to show the current scope at the top of the editor.

### 2. Collapsible Sections
- **Sync**: Collapse/Expand state is synchronized between the Markdown Viewer, Table of Contents (TOC) sidebar, and the Editor.
- **Visuals**:
  - **Viewer**: Headings have a right-aligned chevron button that toggles visibility of the section.
  - **TOC**: Sidebar items have expand/collapse indicators.
  - **Editor**: Collapsed sections are visually hidden (folded) in the editor view, controlled by the shared `collapsedIds` state.
- **Interaction**: Clicking the chevron in the Viewer or the toggle in the TOC updates the shared state, reflecting immediately across all views.

### 3. Presentation Mode
- **Footer**: The presentation footer (page number, metadata) is fixed at the bottom (`absolute bottom-0`).
- **Content Padding**: Slide content has bottom padding (`pb-16`) to prevent text from being obscured by the footer when scrolling.
- **Layout**: Supports `two-cols` layout via `::right::` delimiter and `center` layout.

### 4. Code Cleanup
- **Slides Gallery**: Legacy code related to "Slides Gallery" (a deprecated view) has been removed to streamline the codebase.
- **Selection Toolbar**: Unified toolbar logic handling selection in both Viewer and Editor.

## Implementation Details

### Files
- `MarkdownHeadingBlock.tsx`: Implements the sticky header and chevron toggle.
- `MarkdownEditorPane.tsx`: Handles folding (via `setHiddenAreas`) based on `collapsedIds`.
- `useMarkdownSectionLogic.ts`: Manages the shared `collapsedIds` state.
- `markdownPresentationSlides.tsx`: Defines slide layout and styling, including footer overlap fixes.

### State Management
- `collapsedIds`: A `Set<string>` containing IDs of collapsed headings.
- `onToggleCollapse`: Callback to toggle state, passed down to Viewer and TOC.

## Future Improvements
- **Bidirectional Editor Folding**: Currently, editor folding via the gutter does not update the shared `collapsedIds` state. Future work could link Monaco's internal folding model to the React state.
