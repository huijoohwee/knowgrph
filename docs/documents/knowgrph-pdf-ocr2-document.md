# knowgrph-pdf-ocr2-document

## Overview

This document describes the PDF → Markdown conversion pipeline, focusing on the optional DeepSeek-OCR-2 enhancement stage.

**Primary goal**: improve Markdown fidelity (text + embedded images) while keeping the PDF conversion implementation fully in-repo and free of external PDF parsing dependencies.

## Architecture

### Base Conversion (Native, In-Repo)

- Input: PDF bytes (URL fetch or local file upload)
- Output: Markdown text + extracted image assets (served as same-origin URLs)

Key properties:

- Extracts text via PDF content streams (operators like `Tj`/`TJ`) and ToUnicode/CMap decoding.
- Extracts embedded images from page resources (`/XObject`) and embeds them as Markdown image tokens.
- Normalizes extracted Markdown to remove common PDF spacing artifacts.

### OCR Enhancement (Optional, DeepSeek-OCR-2)

When enabled, the converter can run DeepSeek-OCR-2 against extracted page images and inject the returned Markdown into each page section.

Key properties:

- OCR runs on images only (no PDF rendering, no PDF parsing libraries).
- OCR is executed server-side during conversion to avoid CORS and to keep model infrastructure out of the browser.
- OCR output headings are shifted down to avoid breaking the page section structure.

## End-to-End Flow

1. Client posts PDF (or PDF URL) to `/__convert_pdf`.
2. Dev/preview server writes PDF to a temp file.
3. Native PDF extractor returns `{ markdown, assets[] }`.
4. Server writes assets into a temp directory and serves them under `/__pdf_assets/<token>/...`.
5. Markdown normalization runs (spacing/word-join cleanup).
6. Client receives Markdown and proceeds with the normal Import → Parse → Store → Render pipeline.

## Configuration

### Image embedding

- `KNOWGRPH_PDF_INCLUDE_IMAGES=1`: embed images into Markdown for every page.
- `KNOWGRPH_PDF_MAX_EXTRACTED_IMAGES_PER_PAGE`: bound how many image XObjects are extracted per page.
- `KNOWGRPH_PDF_MAX_EMBEDDED_IMAGES_PER_PAGE`: bound how many extracted images are embedded per page.

### DeepSeek-OCR-2 enhancement

- `KNOWGRPH_DEEPSEEK_OCR2_ENABLE=1`: enable OCR enhancement.
- `KNOWGRPH_DEEPSEEK_OCR2_ENDPOINT`: HTTP endpoint that accepts `{ filename, prompt, imageBase64 }` and returns `{ ok, markdown }`.
- `KNOWGRPH_DEEPSEEK_OCR2_MODE=always|fallback`: run on every page or only when extracted text is sparse.
- `KNOWGRPH_DEEPSEEK_OCR2_MIN_TEXT_CHARS`: fallback threshold for “sparse text”.
- `KNOWGRPH_DEEPSEEK_OCR2_MAX_IMAGES_PER_PAGE`: max images to consider for OCR per page.
- `KNOWGRPH_DEEPSEEK_OCR2_TIMEOUT_MS`: request timeout.
- `KNOWGRPH_DEEPSEEK_OCR2_PROMPT`: prompt override (default: `<image>\n<|grounding|>Convert the document to markdown. `).

## Reference Server (Optional)

The repo includes a minimal reference server that wraps DeepSeek-OCR-2 transformers inference and exposes an HTTP endpoint compatible with the converter:

- `knowgrph/tools/deepseek_ocr2_server.py`

This server is intentionally isolated and optional. The main app does not import any DeepSeek-OCR-2 Python dependencies.

