import os
from typing import Any, Dict, List, Optional, Tuple

from .common import (
    DEFAULT_AGENTIC_RAG_CONTEXT_URL,
    DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    DEFAULT_TERM_IRI_BASE,
    find_repo_root,
    read_text,
    safe_relpath,
    sha256_text,
    slugify,
    utc_now_iso,
)
from .markdown_blocks import extract_links, parse_blocks, split_lines


def _parse_frontmatter(lines: List[str]) -> Tuple[Dict[str, str], int]:
    if not lines or lines[0].strip() != "---":
        return {}, 0
    meta: Dict[str, str] = {}
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return meta, i + 1
        raw = lines[i].strip()
        if not raw or raw.startswith("#"):
            continue
        if ":" not in raw:
            continue
        k, v = raw.split(":", 1)
        key = k.strip()
        val = v.strip()
        if key:
            meta[key] = val
    return meta, 0


def parse_markdown_text_to_graph_jsonld(
    markdown_text: str,
    *,
    graph_id: Optional[str] = None,
    agentic_rag_schema_url: str = DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    agentic_rag_context_url: str = DEFAULT_AGENTIC_RAG_CONTEXT_URL,
    term_iri_base: str = DEFAULT_TERM_IRI_BASE,
    codebase_root: Optional[str] = None,
    source_path: Optional[str] = None,
    source_uri: Optional[str] = None,
    provenance_source: Optional[str] = None,
    layout_suggest: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    raw = markdown_text or ""
    lines = split_lines(raw)
    fm, content_start = _parse_frontmatter(lines)
    content_lines = lines[content_start:] if content_start > 0 else lines
    blocks = parse_blocks(content_lines)

    gid = str(graph_id or "").strip()
    if not gid:
        fm_gid = str(fm.get("graphId") or fm.get("graph_id") or fm.get("graph") or "").strip()
        if fm_gid:
            gid = fm_gid
    if not gid:
        gid = "md:x"

    fm_schema = str(fm.get("agenticRagSchema") or fm.get("agenticrag_schema") or "").strip()
    if fm_schema:
        agentic_rag_schema_url = fm_schema
    fm_context = str(fm.get("agenticRagContext") or fm.get("agenticrag_context") or "").strip()
    if fm_context:
        agentic_rag_context_url = fm_context
    fm_term_base = str(fm.get("termIriBase") or fm.get("term_iri_base") or "").strip()
    if fm_term_base:
        term_iri_base = fm_term_base

    doc_title = str(fm.get("title") or "").strip()
    if not doc_title:
        for b in blocks:
            if b.kind == "heading" and b.level == 1 and b.text.strip():
                doc_title = b.text.strip()
                break
    if not doc_title:
        doc_title = "Markdown Document"

    doc_node_id = f"doc:{gid}"
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    root_norm = os.path.abspath(codebase_root) if isinstance(codebase_root, str) and codebase_root.strip() else None
    rel_norm = safe_relpath(source_path, root_norm) if root_norm and source_path else None

    def mk_meta(start_line: int, end_line: int) -> Dict[str, Any]:
        meta: Dict[str, Any] = {"parsedAt": utc_now_iso()}
        src = str(provenance_source or "").strip()
        if src:
            meta["source"] = src
        if root_norm:
            meta["codebaseRoot"] = root_norm.replace("\\", "/")
        if rel_norm:
            meta["codebaseRelPath"] = rel_norm
            meta["documentPath"] = rel_norm
        if source_uri:
            meta["sourceUri"] = source_uri
        if source_path:
            meta["sourcePath"] = source_path.replace("\\", "/")
            frag = f"#L{start_line}" if start_line == end_line else f"#L{start_line}-{end_line}"
            meta["codebasePath"] = f"{os.path.abspath(source_path)}{frag}"
        meta["lineStart"] = int(start_line)
        meta["lineEnd"] = int(end_line)
        if raw:
            meta["sourceSha256"] = sha256_text(raw)
        return meta

    doc_props: Dict[str, Any] = {"format": "text/markdown", "graphId": gid}
    if rel_norm:
        doc_props["path"] = rel_norm
    if source_uri:
        doc_props["uri"] = source_uri
    elif source_path:
        doc_props["uri"] = f"file://{os.path.abspath(source_path)}"
    doc_chunk = f"{doc_title}\n\nSource: {rel_norm or source_path or 'inline'}"

    nodes.append(
        {
            "@id": doc_node_id,
            "@type": "Document",
            "labels": ["Document"],
            "name": doc_title,
            "chunk_text": doc_chunk,
            "properties": doc_props,
            "metadata": mk_meta(1, max(1, len(content_lines))),
        }
    )

    section_stack: List[Tuple[int, str]] = []
    current_section_id: str = doc_node_id
    last_block_id: Optional[str] = None

    def add_edge(
        src: str,
        label: str,
        tgt: str,
        *,
        props: Optional[Dict[str, Any]] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        edge_id = f"edge:{slugify(src)}:{slugify(label)}:{slugify(tgt)}:{len(edges)}"
        rec: Dict[str, Any] = {
            "@type": "Edge",
            "@id": edge_id,
            "source_node": src,
            "target_node": tgt,
            "relation": label,
        }
        if props:
            rec["properties"] = props
        if meta:
            rec["metadata"] = meta
        edges.append(rec)

    def add_sequence(prev_id: Optional[str], next_id: str, *, meta: Optional[Dict[str, Any]] = None) -> None:
        if prev_id:
            add_edge(prev_id, "next", next_id, meta=meta)

    block_index_by_parent: Dict[str, int] = {}

    for b in blocks:
        start_line = b.start_line + content_start
        end_line = b.end_line + content_start

        if b.kind == "heading" and b.level:
            while section_stack and section_stack[-1][0] >= b.level:
                section_stack.pop()
            parent_id = section_stack[-1][1] if section_stack else doc_node_id
            anchor = slugify(b.text)
            sec_id = f"sec:{gid}:{anchor}:{start_line}"
            order = block_index_by_parent.get(parent_id, 0) + 1
            block_index_by_parent[parent_id] = order
            nodes.append(
                {
                    "@id": sec_id,
                    "@type": "Section",
                    "labels": ["Section"],
                    "name": b.text,
                    "chunk_text": f"{b.text}",
                    "properties": {
                        "heading": b.text,
                        "level": b.level,
                        "anchor": anchor,
                        "order": order,
                    },
                    "metadata": mk_meta(start_line, end_line),
                }
            )
            add_edge(parent_id, "hasSection", sec_id, props={"order": order}, meta=mk_meta(start_line, end_line))
            add_sequence(last_block_id, sec_id, meta=mk_meta(start_line, end_line))
            last_block_id = sec_id
            section_stack.append((b.level, sec_id))
            current_section_id = sec_id
            continue

        parent_id = current_section_id or doc_node_id
        order = block_index_by_parent.get(parent_id, 0) + 1
        block_index_by_parent[parent_id] = order
        meta_block = mk_meta(start_line, end_line)

        if b.kind == "paragraph":
            p_id = f"blk:{gid}:p:{start_line}:{order}"
            nodes.append(
                {
                    "@id": p_id,
                    "@type": "Paragraph",
                    "labels": ["Paragraph"],
                    "name": f"Paragraph {order}",
                    "chunk_text": b.text[:800],
                    "properties": {
                        "text": b.text,
                        "order": order,
                        "charCount": len(b.text),
                    },
                    "metadata": meta_block,
                }
            )
            add_edge(parent_id, "hasBlock", p_id, props={"order": order}, meta=meta_block)
            add_sequence(last_block_id, p_id, meta=meta_block)
            last_block_id = p_id

            for label, url in extract_links(b.text):
                link_id = f"link:{slugify(url)}"
                if not any(n.get("@id") == link_id for n in nodes):
                    nodes.append(
                        {
                            "@id": link_id,
                            "@type": "Link",
                            "labels": ["Link"],
                            "name": label,
                            "chunk_text": label[:800] if isinstance(label, str) else "",
                            "properties": {"url": url, "label": label},
                            "metadata": meta_block,
                        }
                    )
                add_edge(p_id, "linksTo", link_id, props={"text": label}, meta=meta_block)
            continue

        if b.kind == "code":
            c_id = f"blk:{gid}:code:{start_line}:{order}"
            props: Dict[str, Any] = {"code": b.text, "order": order, "charCount": len(b.text)}
            if b.extra and isinstance(b.extra.get("language"), str) and b.extra["language"].strip():
                props["language"] = b.extra["language"].strip()
            nodes.append(
                {
                    "@id": c_id,
                    "@type": "CodeBlock",
                    "labels": ["CodeBlock"],
                    "name": f"Code {order}",
                    "chunk_text": (b.text[:800] if b.text else ""),
                    "properties": props,
                    "metadata": meta_block,
                }
            )
            add_edge(parent_id, "hasBlock", c_id, props={"order": order}, meta=meta_block)
            add_sequence(last_block_id, c_id, meta=meta_block)
            last_block_id = c_id
            continue

        if b.kind == "table":
            t_id = f"blk:{gid}:table:{start_line}:{order}"
            nodes.append(
                {
                    "@id": t_id,
                    "@type": "Table",
                    "labels": ["Table"],
                    "name": f"Table {order}",
                    "chunk_text": b.text[:800],
                    "properties": {"markdown": b.text, "order": order},
                    "metadata": meta_block,
                }
            )
            add_edge(parent_id, "hasBlock", t_id, props={"order": order}, meta=meta_block)
            add_sequence(last_block_id, t_id, meta=meta_block)
            last_block_id = t_id
            continue

        if b.kind == "list":
            l_id = f"blk:{gid}:list:{start_line}:{order}"
            items = (b.extra or {}).get("items") if b.extra else None
            items_list = items if isinstance(items, list) else []
            nodes.append(
                {
                    "@id": l_id,
                    "@type": "List",
                    "labels": ["List"],
                    "name": f"List {order}",
                    "chunk_text": "\n".join([str((it or {}).get("text") or "") for it in items_list if isinstance(it, dict)])[:800],
                    "properties": {"order": order},
                    "metadata": meta_block,
                }
            )
            add_edge(parent_id, "hasBlock", l_id, props={"order": order}, meta=meta_block)
            add_sequence(last_block_id, l_id, meta=meta_block)
            last_block_id = l_id
            for idx, item in enumerate(items_list):
                txt = item.get("text") if isinstance(item, dict) else ""
                it_id = f"blk:{gid}:li:{start_line}:{idx + 1}"
                nodes.append(
                    {
                        "@id": it_id,
                        "@type": "ListItem",
                        "labels": ["ListItem"],
                        "name": txt[:80] if isinstance(txt, str) and txt else f"Item {idx + 1}",
                        "chunk_text": (txt[:800] if isinstance(txt, str) else ""),
                        "properties": {
                            "text": txt,
                            "ordered": bool(item.get("ordered")) if isinstance(item, dict) else False,
                            "index": item.get("index") if isinstance(item, dict) else None,
                            "order": idx + 1,
                        },
                        "metadata": meta_block,
                    }
                )
                add_edge(l_id, "hasItem", it_id, props={"order": idx + 1}, meta=meta_block)
            continue

    vocab = str(term_iri_base or "").strip()
    if not vocab:
        vocab = DEFAULT_TERM_IRI_BASE
    ctx: Dict[str, Any] = {
        "@vocab": vocab,
        "labels": {"@container": "@list"},
        "embedding": {"@container": "@list"},
        "properties": {"@type": "@json"},
        "metadata": {"@type": "@json"},
        "source_node": {"@type": "@id"},
        "target_node": {"@type": "@id"},
    }

    doc_metadata: Dict[str, Any] = {
        "graphId": gid,
        "generatedAt": utc_now_iso(),
        "agenticRagSchema": agentic_rag_schema_url,
        "agenticRagContext": agentic_rag_context_url,
        "layoutMode": "tidy-tree",
        "tidyTree": {"edgeLabels": ["hasSection", "hasBlock", "hasItem"]},
        "suggestedTraversalEdges": ["hasSection", "hasBlock", "hasItem", "linksTo", "next"],
    }
    if isinstance(layout_suggest, dict) and layout_suggest:
        doc_metadata.update(layout_suggest)

    doc: Dict[str, Any] = {
        "@context": [agentic_rag_context_url, ctx] if agentic_rag_context_url else ctx,
        "@graph": nodes + edges,
        "metadata": doc_metadata,
    }
    return doc


def parse_markdown_to_graph_jsonld(
    markdown_path: str,
    codebase_root: Optional[str] = None,
    graph_id: Optional[str] = None,
    agentic_rag_schema_url: str = DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    agentic_rag_context_url: str = DEFAULT_AGENTIC_RAG_CONTEXT_URL,
    term_iri_base: str = DEFAULT_TERM_IRI_BASE,
) -> Dict[str, Any]:
    abs_path = os.path.abspath(markdown_path)
    raw = read_text(abs_path)
    root = os.path.abspath(codebase_root) if codebase_root else find_repo_root(abs_path)
    rel = safe_relpath(abs_path, root)
    gid = (
        graph_id.strip()
        if isinstance(graph_id, str) and graph_id.strip()
        else f"md:{slugify(os.path.splitext(os.path.basename(abs_path))[0])}"
    )
    return parse_markdown_text_to_graph_jsonld(
        raw,
        graph_id=gid,
        agentic_rag_schema_url=agentic_rag_schema_url,
        agentic_rag_context_url=agentic_rag_context_url,
        term_iri_base=term_iri_base,
        codebase_root=root,
        source_path=abs_path,
        source_uri=f"file://{abs_path}",
        provenance_source="knowgrph_parser.markdown_graph",
    )
