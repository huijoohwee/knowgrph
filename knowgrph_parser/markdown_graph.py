import os
import re
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


_WORD_RE = re.compile(r"[A-Za-z0-9_]+")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def _clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x


def _env_float(key: str, fallback: float) -> float:
    raw = os.getenv(key, "").strip()
    if not raw:
        return float(fallback)
    try:
        val = float(raw)
        if val != val:
            return float(fallback)
        return float(val)
    except Exception:
        return float(fallback)


def _env_int(key: str, fallback: int) -> int:
    raw = os.getenv(key, "").strip()
    if not raw:
        return int(fallback)
    try:
        val = int(float(raw))
        return int(val)
    except Exception:
        return int(fallback)


def _env_bool(key: str, fallback: bool) -> bool:
    raw = os.getenv(key, "").strip().lower()
    if not raw:
        return bool(fallback)
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return bool(fallback)


def _parse_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    return None


def _parse_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        val = float(value)
        return val if val == val else None
    text = str(value or "").strip()
    if not text:
        return None
    try:
        val = float(text)
        return val if val == val else None
    except Exception:
        return None


def _parse_int(value: Any) -> Optional[int]:
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(float(text))
    except Exception:
        return None


def _tokenize_with_offsets(text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for m in _WORD_RE.finditer(text or ""):
        tok = m.group(0) or ""
        if not tok:
            continue
        start = int(m.start())
        end = int(m.end())
        is_word = any(c.isalpha() for c in tok)
        kind = "word" if is_word else "num"
        out.append({"text": tok, "start": start, "end": end, "kind": kind})
    return out


def _token_kind_score(token: str) -> Tuple[str, float]:
    if not token:
        return "other", 0.5
    if token.isupper() and any(c.isalpha() for c in token):
        return "upper", 0.85
    if token[:1].isupper() and any(c.isalpha() for c in token):
        return "capitalized", 0.8
    if "_" in token or "." in token:
        return "identifier", 0.8
    if any(c.isalpha() for c in token) and any(c.isupper() for c in token[1:]):
        return "identifier", 0.75
    return "word", 0.55


def _merge_tokens_to_spans(
    tokens: List[Dict[str, Any]],
    *,
    phrase_boundary_threshold: float,
    max_entity_span_tokens: int,
) -> List[Dict[str, Any]]:
    spans: List[Dict[str, Any]] = []
    i = 0
    while i < len(tokens):
        t0 = tokens[i]
        tok = str(t0.get("text") or "")
        kind0, base0 = _token_kind_score(tok)
        if kind0 not in {"capitalized", "upper", "identifier"}:
            i += 1
            continue
        start_i = i
        end_i = i + 1
        best_score = base0
        while end_i < len(tokens) and (end_i - start_i) < max_entity_span_tokens:
            prev = str(tokens[end_i - 1].get("text") or "")
            cur = str(tokens[end_i].get("text") or "")
            pk, ps = _token_kind_score(prev)
            ck, cs = _token_kind_score(cur)
            coherence = 0.9 if pk == ck and pk in {"capitalized", "upper", "identifier"} else 0.6
            if coherence < phrase_boundary_threshold:
                break
            end_i += 1
            best_score = max(best_score, (ps + cs + coherence) / 3.0)
        span_tokens = tokens[start_i:end_i]
        text = " ".join([str(t.get("text") or "") for t in span_tokens]).strip()
        if text:
            spans.append(
                {
                    "text": text,
                    "start": int(span_tokens[0].get("start") or 0),
                    "end": int(span_tokens[-1].get("end") or 0),
                    "tokenStart": start_i,
                    "tokenEnd": end_i - 1,
                    "confidence": _clamp01(float(best_score)),
                }
            )
        i = end_i
    return spans


def _detect_inline_code_spans(text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for m in _INLINE_CODE_RE.finditer(text or ""):
        inner = (m.group(1) or "").strip()
        if not inner:
            continue
        out.append(
            {
                "text": inner,
                "start": int(m.start(1)),
                "end": int(m.end(1)),
                "tokenStart": None,
                "tokenEnd": None,
                "confidence": 0.9,
            }
        )
    return out


def _extract_sentence_features(sentence: str) -> Dict[str, Any]:
    s = (sentence or "").strip()
    lowered = s.lower()
    temporal = ""
    for w in ["before", "after", "during", "then", "next", "previously", "later"]:
        if re.search(rf"\b{re.escape(w)}\b", lowered):
            temporal = w
            break
    modality = ""
    for w in ["may", "might", "can", "could", "should", "must", "will"]:
        if re.search(rf"\b{re.escape(w)}\b", lowered):
            modality = w
            break
    negation = False
    for w in ["not", "never", "no"]:
        if re.search(rf"\b{re.escape(w)}\b", lowered):
            negation = True
            break
    return {"temporalMarker": temporal, "modality": modality, "negation": bool(negation)}


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
    semantic_enabled: Optional[bool] = None,
    semantic_config: Optional[Dict[str, Any]] = None,
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
    semantic_sources: List[Dict[str, Any]] = []

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
            semantic_sources.append(
                {
                    "blockId": sec_id,
                    "blockType": "Section",
                    "text": b.text,
                    "meta": mk_meta(start_line, end_line),
                }
            )
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
            semantic_sources.append(
                {
                    "blockId": p_id,
                    "blockType": "Paragraph",
                    "text": b.text,
                    "meta": meta_block,
                }
            )

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
            semantic_sources.append(
                {
                    "blockId": c_id,
                    "blockType": "CodeBlock",
                    "text": b.text,
                    "meta": meta_block,
                }
            )
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
            semantic_sources.append(
                {
                    "blockId": t_id,
                    "blockType": "Table",
                    "text": b.text,
                    "meta": meta_block,
                }
            )
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
                if isinstance(txt, str) and txt.strip():
                    semantic_sources.append(
                        {
                            "blockId": it_id,
                            "blockType": "ListItem",
                            "text": txt,
                            "meta": meta_block,
                        }
                    )
            continue

    semantic_enabled_value = semantic_enabled if isinstance(semantic_enabled, bool) else _parse_bool(fm.get("semanticEnabled"))
    sem_enabled = True if semantic_enabled_value is None else bool(semantic_enabled_value)

    sem_defaults: Dict[str, Any] = {
        "phrase_boundary_threshold": _env_float("KG_PHRASE_BOUNDARY_THRESHOLD", 0.75),
        "max_entity_span_tokens": _env_int("KG_MAX_ENTITY_SPAN_TOKENS", 8),
        "edge_confidence_threshold": _env_float("KG_EDGE_CONFIDENCE_THRESHOLD", 0.65),
        "max_syntactic_path_length": _env_int("KG_MAX_SYNTACTIC_PATH_LENGTH", 4),
        "auto_tune_enabled": _env_bool("KG_AUTO_TUNE_ENABLED", True),
        "tuning_sensitivity": _env_float("KG_TUNING_SENSITIVITY", 0.1),
        "min_pattern_support": _env_float("KG_MIN_PATTERN_SUPPORT", 0.05),
        "emergent_relationship_threshold": _env_float("KG_EMERGENT_RELATIONSHIP_THRESHOLD", 0.7),
        "corpus_centrality_algorithm": os.getenv("KG_CORPUS_CENTRALITY_ALGORITHM", "pagerank").strip() or "pagerank",
    }

    for k, v in {
        "phrase_boundary_threshold": fm.get("phraseBoundaryThreshold"),
        "max_entity_span_tokens": fm.get("maxEntitySpanTokens"),
        "edge_confidence_threshold": fm.get("edgeConfidenceThreshold"),
        "max_syntactic_path_length": fm.get("maxSyntacticPathLength"),
        "auto_tune_enabled": fm.get("autoTuneEnabled"),
        "tuning_sensitivity": fm.get("tuningSensitivity"),
        "min_pattern_support": fm.get("minPatternSupport"),
        "emergent_relationship_threshold": fm.get("emergentRelationshipThreshold"),
        "corpus_centrality_algorithm": fm.get("corpusCentralityAlgorithm"),
    }.items():
        if v is None:
            continue
        if k in {"corpus_centrality_algorithm"}:
            val = str(v or "").strip()
            if val:
                sem_defaults[k] = val
            continue
        if k in {"auto_tune_enabled"}:
            b = _parse_bool(v)
            if b is not None:
                sem_defaults[k] = bool(b)
            continue
        if k in {"max_entity_span_tokens", "max_syntactic_path_length"}:
            iv = _parse_int(v)
            if iv is not None:
                sem_defaults[k] = int(iv)
            continue
        fv = _parse_float(v)
        if fv is not None:
            sem_defaults[k] = float(fv)

    if isinstance(semantic_config, dict) and semantic_config:
        sem_defaults.update(semantic_config)

    semantic_doc_profile: Dict[str, Any] = {}
    if sem_enabled and semantic_sources:
        joined_text = "\n".join([str(s.get("text") or "") for s in semantic_sources])
        toks = _tokenize_with_offsets(joined_text)
        token_count = len(toks)
        sentence_count = len([s for s in _SENTENCE_SPLIT_RE.split(joined_text) if s.strip()])
        avg_sentence_tokens = (token_count / sentence_count) if sentence_count else 0.0
        semantic_doc_profile = {
            "tokenCount": token_count,
            "sentenceCount": sentence_count,
            "avgSentenceTokens": avg_sentence_tokens,
        }

        if bool(sem_defaults.get("auto_tune_enabled")):
            sensitivity = float(sem_defaults.get("tuning_sensitivity") or 0.1)
            if avg_sentence_tokens > 20:
                sem_defaults["max_syntactic_path_length"] = max(2, int(sem_defaults.get("max_syntactic_path_length") or 4) - 1)
            if avg_sentence_tokens < 8:
                sem_defaults["max_syntactic_path_length"] = min(8, int(sem_defaults.get("max_syntactic_path_length") or 4) + 1)
            sem_defaults["phrase_boundary_threshold"] = _clamp01(float(sem_defaults.get("phrase_boundary_threshold") or 0.75) + (sensitivity * 0.0))

    entity_by_key: Dict[str, str] = {}
    entity_props_by_id: Dict[str, Dict[str, Any]] = {}
    mentions: List[Dict[str, Any]] = []

    if sem_enabled:
        phrase_boundary_threshold = float(sem_defaults.get("phrase_boundary_threshold") or 0.75)
        max_entity_span_tokens = int(sem_defaults.get("max_entity_span_tokens") or 8)
        for src in semantic_sources:
            block_id = str(src.get("blockId") or "")
            block_type = str(src.get("blockType") or "Block")
            text = str(src.get("text") or "")
            meta = src.get("meta")
            meta_block = meta if isinstance(meta, dict) else {}

            tokens = _tokenize_with_offsets(text)
            token_spans = _merge_tokens_to_spans(
                tokens,
                phrase_boundary_threshold=phrase_boundary_threshold,
                max_entity_span_tokens=max_entity_span_tokens,
            )
            code_spans = _detect_inline_code_spans(text)
            all_spans = token_spans + code_spans

            for span in all_spans:
                span_text = str(span.get("text") or "").strip()
                if not span_text:
                    continue
                start_char = int(span.get("start") or 0)
                end_char = int(span.get("end") or 0)
                mention_key = f"{block_id}:{start_char}:{end_char}:{span_text}"
                mention_id = f"men:{gid}:{sha256_text(mention_key)[:12]}"
                conf = float(span.get("confidence") or 0.6)
                entity_type = "Entity"
                if span in code_spans:
                    entity_type = "CodeSpan"
                ek = f"{entity_type}:{span_text.strip().lower()}"
                ent_id = entity_by_key.get(ek)
                if not ent_id:
                    ent_id = f"ent:{gid}:{sha256_text(ek)[:12]}"
                    entity_by_key[ek] = ent_id
                    entity_props_by_id[ent_id] = {
                        "@id": ent_id,
                        "@type": "Entity",
                        "labels": ["Entity"],
                        "name": span_text[:120],
                        "chunk_text": span_text[:800],
                        "properties": {
                            "text": span_text,
                            "normalizedText": span_text.strip().lower(),
                            "entityType": entity_type,
                        },
                        "metadata": dict(meta_block, **{"structureType": "Entity", "extractionMethod": "document_unification"}),
                    }
                mention_node: Dict[str, Any] = {
                    "@id": mention_id,
                    "@type": "Mention",
                    "labels": ["Mention"],
                    "name": span_text[:120],
                    "chunk_text": span_text[:800],
                    "properties": {
                        "text": span_text,
                        "blockId": block_id,
                        "blockType": block_type,
                        "charStart": start_char,
                        "charEnd": end_char,
                        "tokenStart": span.get("tokenStart"),
                        "tokenEnd": span.get("tokenEnd"),
                        "confidence": _clamp01(conf),
                    },
                    "metadata": dict(meta_block, **{"structureType": "Mention", "extractionMethod": "token_linking"}),
                }
                nodes.append(mention_node)
                mentions.append({"mentionId": mention_id, "entityId": ent_id, "blockId": block_id, "charStart": start_char, "charEnd": end_char})
                add_edge(block_id, "hasMention", mention_id, props={"confidence": _clamp01(conf)}, meta=meta_block)
                add_edge(mention_id, "mentionOf", block_id, props={"blockType": block_type}, meta=meta_block)
                add_edge(mention_id, "refersTo", ent_id, props={"confidence": _clamp01(conf)}, meta=meta_block)
                add_edge(ent_id, "hasMention", mention_id, props={"confidence": _clamp01(conf)}, meta=meta_block)

        for ent in entity_props_by_id.values():
            nodes.append(ent)

        max_path_len = int(sem_defaults.get("max_syntactic_path_length") or 4)
        edge_threshold = float(sem_defaults.get("edge_confidence_threshold") or 0.65)
        mentions_by_block: Dict[str, List[Dict[str, Any]]] = {}
        for m in mentions:
            mentions_by_block.setdefault(str(m.get("blockId") or ""), []).append(m)

        seen_semantic_edges: set = set()
        for src in semantic_sources:
            block_id = str(src.get("blockId") or "")
            block_text = str(src.get("text") or "")
            meta = src.get("meta")
            meta_block = meta if isinstance(meta, dict) else {}
            block_mentions = mentions_by_block.get(block_id) or []
            if len(block_mentions) < 2:
                continue
            sentences = [s for s in _SENTENCE_SPLIT_RE.split(block_text) if s.strip()]
            for sent in sentences:
                s0 = sent.strip()
                if not s0:
                    continue
                span_start = block_text.find(s0)
                if span_start < 0:
                    span_start = 0
                span_end = span_start + len(s0)
                local = [
                    m for m in block_mentions if int(m.get("charStart") or 0) >= span_start and int(m.get("charEnd") or 0) <= span_end
                ]
                ent_ids = []
                for m in sorted(local, key=lambda x: int(x.get("charStart") or 0)):
                    eid = str(m.get("entityId") or "")
                    if eid and eid not in ent_ids:
                        ent_ids.append(eid)
                if len(ent_ids) < 2:
                    continue
                features = _extract_sentence_features(s0)
                for a in range(len(ent_ids)):
                    for b in range(a + 1, len(ent_ids)):
                        src_e = ent_ids[a]
                        tgt_e = ent_ids[b]
                        rel_text = s0[:240]
                        between_conf = 0.5
                        if "->" in s0 or "→" in s0:
                            between_conf += 0.2
                        if features.get("temporalMarker"):
                            between_conf += 0.1
                        if features.get("modality"):
                            between_conf -= 0.05
                        if features.get("negation"):
                            between_conf -= 0.05
                        conf = _clamp01(between_conf)
                        if conf < edge_threshold:
                            continue
                        if max_path_len and len(ent_ids) > max_path_len:
                            continue
                        key = f"{src_e}:{tgt_e}:{block_id}:{rel_text}"
                        if key in seen_semantic_edges:
                            continue
                        seen_semantic_edges.add(key)
                        add_edge(
                            src_e,
                            "semanticRelation",
                            tgt_e,
                            props={
                                "confidence": conf,
                                "sourceSentence": s0,
                                "temporalMarker": features.get("temporalMarker") or "",
                                "modality": features.get("modality") or "",
                                "negation": bool(features.get("negation")),
                            },
                            meta=dict(meta_block, **{"structureType": "Edge", "extractionMethod": "edge_elevation", "sourceBlockId": block_id}),
                        )

        blocks_with_entities = []
        for src in semantic_sources:
            block_id = str(src.get("blockId") or "")
            ent_set = {str(m.get("entityId") or "") for m in (mentions_by_block.get(block_id) or []) if str(m.get("entityId") or "")}
            if ent_set:
                blocks_with_entities.append(ent_set)
        block_count = len(blocks_with_entities)
        pair_counts: Dict[Tuple[str, str], int] = {}
        if block_count > 0:
            for ent_set in blocks_with_entities:
                ids = sorted(ent_set)
                for i in range(len(ids)):
                    for j in range(i + 1, len(ids)):
                        k = (ids[i], ids[j])
                        pair_counts[k] = pair_counts.get(k, 0) + 1
            min_support = float(sem_defaults.get("min_pattern_support") or 0.05)
            for (a, b), cnt in pair_counts.items():
                support = float(cnt) / float(block_count)
                if support < min_support:
                    continue
                add_edge(
                    a,
                    "coOccursWith",
                    b,
                    props={"support": support, "confidence": support},
                    meta={"structureType": "Edge", "extractionMethod": "pattern_mining", "blockCount": block_count},
                )

        if sem_defaults.get("corpus_centrality_algorithm") == "pagerank":
            entity_ids = list(entity_props_by_id.keys())
            neighbors: Dict[str, List[str]] = {eid: [] for eid in entity_ids}
            for e in edges:
                if not isinstance(e, dict):
                    continue
                if e.get("relation") not in {"semanticRelation", "coOccursWith"}:
                    continue
                s = str(e.get("source_node") or "")
                t = str(e.get("target_node") or "")
                if s in neighbors and t in neighbors and s != t:
                    neighbors[s].append(t)
                    neighbors[t].append(s)
            n = len(entity_ids)
            if n > 0:
                pr = {eid: 1.0 / n for eid in entity_ids}
                damping = 0.85
                for _ in range(20):
                    nxt = {eid: (1.0 - damping) / n for eid in entity_ids}
                    for eid in entity_ids:
                        outs = neighbors.get(eid) or []
                        if not outs:
                            continue
                        share = pr[eid] / len(outs)
                        for nb in outs:
                            nxt[nb] = nxt.get(nb, 0.0) + damping * share
                    pr = nxt
                for eid in entity_ids:
                    ent_obj = entity_props_by_id.get(eid)
                    if not ent_obj:
                        continue
                    props = ent_obj.get("properties")
                    props_dict = props if isinstance(props, dict) else {}
                    props_dict["centrality"] = float(pr.get(eid) or 0.0)
                    ent_obj["properties"] = props_dict

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
        "suggestedTraversalEdges": [
            "hasSection",
            "hasBlock",
            "hasItem",
            "linksTo",
            "next",
            "hasMention",
            "mentionOf",
            "refersTo",
            "semanticRelation",
            "coOccursWith",
        ],
    }
    if sem_enabled:
        doc_metadata["semanticConfig"] = sem_defaults
        if semantic_doc_profile:
            doc_metadata["documentProfile"] = semantic_doc_profile
        doc_metadata["semanticEnabled"] = True
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
