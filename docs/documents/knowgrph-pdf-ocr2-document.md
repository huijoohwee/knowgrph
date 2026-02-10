# knowgrph-pdf-ocr2-document

## Overview

This document describes the PDF → Markdown conversion pipeline, focusing on the optional DeepSeek-OCR-2 enhancement stage and the provider selection surface.

**Primary goal**: improve Markdown fidelity (text + embedded images) while keeping a fully local default path and making “online enrichment” opt-in and config-driven.

## Architecture

### Base Conversion (Native, In-Repo)

- Input: PDF bytes (URL fetch or local file upload)
- Output: Markdown text + extracted image assets

Key properties:

- Extracts text via PDF content streams (operators like `Tj`/`TJ`) and ToUnicode/CMap decoding.
- Extracts embedded images from page resources (`/XObject`) and embeds them as Markdown image tokens.
- Normalizes extracted Markdown to remove common PDF spacing artifacts.

### Image Embedding Strategy (Default)

The converter produces Markdown that remains renderable when persisted as a plain text workspace document:

- Preferred: inline `data:<mime>;base64,...` image URLs (bounded by size caps)
- Fallback: `/__pdf_assets/<token>/...` same-origin URLs (served by the dev/preview server while cached)

The default behavior is to attempt data-URI embedding first and leave non-embedded images as `/__pdf_assets/...` links.

### OCR Enhancement (Optional, DeepSeek-OCR-2)

When enabled, the converter can run DeepSeek-OCR-2 against extracted page images and inject the returned Markdown into each page section.

Key properties:

- OCR runs on images only (no PDF rendering, no PDF parsing libraries).
- OCR is executed server-side during conversion to avoid CORS and to keep model infrastructure out of the browser.
- OCR output headings are shifted down to avoid breaking the page section structure.

## End-to-End Flow

1. Client posts PDF (or PDF URL) to `/__convert_pdf`.
2. Dev/preview server converts PDF using a provider (`native` by default).
3. Native provider returns `{ markdown, assets[] }`.
4. Server writes assets into a temp directory and serves them under `/__pdf_assets/<token>/...`.
5. Markdown normalization runs (spacing/word-join cleanup).
6. Server optionally rewrites eligible `(/__pdf_assets/<token>/<file>)` links to `data:` URIs.
7. Client receives Markdown and proceeds with the normal Import → Parse → Store → Render pipeline.

## Configuration

### Provider selection

- `KNOWGRPH_PDF_MODE=online`: prefer online enrichment providers (if configured)
- `KNOWGRPH_PDF_PROVIDER=native|docling-remote`: explicit provider selection
- `KNOWGRPH_DOCLING_ENDPOINT`: HTTP endpoint for Docling-based PDF→Markdown conversion
- `KNOWGRPH_PDF_PROVIDER_FALLBACK_TO_NATIVE=1`: if Docling conversion fails, fall back to native conversion

### MainPanel Settings (UI)

The same conversion knobs are exposed in **MainPanel → Settings** (area: `Import: PDF`) and are applied to all PDF imports (Workspace import, Source Files ingest, and toolbar PDF import) by sending query overrides to `/__convert_pdf`.

- `pdfImportConversionMode` → `conversionMode=text-only|image-heavy|scan-ocr` (preset for the detailed knobs below)
- `pdfImportIncludeImages` → `includeImages=1|0`
- `pdfImportEmbedImages` → `embedImages=1|0`
- `pdfImportMaxExtractedImagesPerPage` → `maxExtractedImagesPerPage=<int>`
- `pdfImportMaxEmbeddedImagesPerPage` → `maxEmbeddedImagesPerPage=<int>`
- `pdfImportMaxEmbeddedTotalBytes` → `maxEmbeddedTotalBytes=<int>`
- `pdfImportMaxEmbeddedAssetBytes` → `maxEmbeddedAssetBytes=<int>`
- `pdfImportProvider` → `provider=native|docling-remote`
- `pdfImportDoclingEndpoint` → `doclingEndpoint=<url>`
- `pdfImportProviderFallbackToNative` → `providerFallbackToNative=1|0`
- `pdfImportDeepseekOcr2Enabled` → `deepseekOcr2=1|0`
- `pdfImportDeepseekOcr2Mode` → `deepseekOcr2Mode=fallback|always`

### Conversion modes (UI preset)

`pdfImportConversionMode` provides a single, high-signal knob that deterministically maps to a bundle of PDF conversion settings. The mode is persisted (local storage) and applied before a conversion request is built.

- `text-only`: favor small, fast Markdown (images off; OCR off).
- `image-heavy`: favor visual fidelity (extract images on; embed images off by default to avoid huge Markdown; OCR off).
- `scan-ocr`: favor scan/document fidelity (OCR on; images off in Markdown by default; conservative embedding limits).

Implementation note: the client sends both `conversionMode` and the resolved detailed settings as query params to `/__convert_pdf`. On the server, explicit query params win; `conversionMode` acts as a preset fallback when a detailed override is omitted.

### Image embedding

- `KNOWGRPH_PDF_INCLUDE_IMAGES=0|1`: enable/disable image extraction + Markdown image insertion (default: enabled)
- `KNOWGRPH_PDF_EMBED_IMAGES=0|1`: enable/disable rewriting eligible asset links to `data:` URIs (default: disabled; embedding can make Markdown large and slow to edit)
- `KNOWGRPH_PDF_MAX_EMBEDDED_ASSET_BYTES`: cap per-asset embedding size (bytes)
- `KNOWGRPH_PDF_MAX_EMBEDDED_TOTAL_BYTES`: cap total embedded image bytes per conversion (bytes)
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

## Code Reference

- Server conversion and handlers: `canvas/src/lib/pdf/server/pdfConvertServer.ts`
- Data-URI embedding: `canvas/src/lib/pdf/embedPdfAssetsInMarkdown.ts`

## CLI Validation

The repo includes a CLI that runs the same conversion logic locally:

- `npm run pdf:convert -- --input <pdfPath> --output <mdPath>`
