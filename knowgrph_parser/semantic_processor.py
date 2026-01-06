import re
from typing import Any, Dict, List, Optional, Tuple, Set

from .config_utils import clamp01
from .token_linker import tokenize_with_offsets, merge_tokens_to_spans, detect_inline_code_spans
from .edge_elevator import extract_sentence_features
from .common import sha256_text

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")

def _add_edge_ref(
    edges: List[Dict[str, Any]],
    src: str,
    label: str,
    tgt: str,
    *,
    props: Optional[Dict[str, Any]] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    # Helper to add edge to the list - duplicative but decoupled
    edge_id = f"edge:{sha256_text(src + label + tgt)[:12]}:{len(edges)}" # simplified ID generation for now or pass in slugify
    # Actually, let's just return the edge object and let caller append
    pass

def process_semantics(
    semantic_sources: List[Dict[str, Any]],
    sem_defaults: Dict[str, Any],
    gid: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    add_edge_callback: Any # function
) -> Dict[str, Any]:
    
    # 1. Profile
    semantic_doc_profile: Dict[str, Any] = {}
    if semantic_sources:
        joined_text = "\n".join([str(s.get("text") or "") for s in semantic_sources])
        toks = tokenize_with_offsets(joined_text)
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
            sem_defaults["phrase_boundary_threshold"] = clamp01(float(sem_defaults.get("phrase_boundary_threshold") or 0.75) + (sensitivity * 0.0))

    # 2. Entity/Mention Extraction
    entity_by_key: Dict[str, str] = {}
    entity_props_by_id: Dict[str, Dict[str, Any]] = {}
    mentions: List[Dict[str, Any]] = []

    phrase_boundary_threshold = float(sem_defaults.get("phrase_boundary_threshold") or 0.75)
    max_entity_span_tokens = int(sem_defaults.get("max_entity_span_tokens") or 8)
    
    for src in semantic_sources:
        block_id = str(src.get("blockId") or "")
        block_type = str(src.get("blockType") or "Block")
        text = str(src.get("text") or "")
        meta = src.get("meta")
        meta_block = meta if isinstance(meta, dict) else {}

        tokens = tokenize_with_offsets(text)
        token_spans = merge_tokens_to_spans(
            tokens,
            phrase_boundary_threshold=phrase_boundary_threshold,
            max_entity_span_tokens=max_entity_span_tokens,
            coreference_distance_limit=int(sem_defaults.get("coreference_distance_limit") or 5),
        )
        code_spans = detect_inline_code_spans(text)
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
                    "confidence": clamp01(conf),
                },
                "metadata": dict(meta_block, **{"structureType": "Mention", "extractionMethod": "token_linking"}),
            }
            nodes.append(mention_node)
            mentions.append({"mentionId": mention_id, "entityId": ent_id, "blockId": block_id, "charStart": start_char, "charEnd": end_char})
            add_edge_callback(edges, block_id, "hasMention", mention_id, props={"confidence": clamp01(conf)}, meta=meta_block)
            add_edge_callback(edges, mention_id, "mentionOf", block_id, props={"blockType": block_type}, meta=meta_block)
            add_edge_callback(edges, mention_id, "refersTo", ent_id, props={"confidence": clamp01(conf)}, meta=meta_block)
            add_edge_callback(edges, ent_id, "hasMention", mention_id, props={"confidence": clamp01(conf)}, meta=meta_block)

    for ent in entity_props_by_id.values():
        nodes.append(ent)

    # 3. Edge Elevation
    max_path_len = int(sem_defaults.get("max_syntactic_path_length") or 4)
    edge_threshold = float(sem_defaults.get("edge_confidence_threshold") or 0.65)
    mentions_by_block: Dict[str, List[Dict[str, Any]]] = {}
    for m in mentions:
        mentions_by_block.setdefault(str(m.get("blockId") or ""), []).append(m)

    seen_semantic_edges: Set[str] = set()
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
            features = extract_sentence_features(s0)
            for a in range(len(ent_ids)):
                for b in range(a + 1, len(ent_ids)):
                    src_e = ent_ids[a]
                    tgt_e = ent_ids[b]
                    rel_text = s0[:240]
                    between_conf = 0.5
                    if "->" in s0 or "→" in s0:
                        between_conf += 0.2
                    if features.get("temporalMarker"):
                        between_conf += float(sem_defaults.get("temporal_marker_boost") or 0.15)
                    if features.get("modality"):
                        between_conf -= 0.05
                    if features.get("negation"):
                        between_conf -= 0.05
                    conf = clamp01(between_conf)
                    if conf < edge_threshold:
                        continue
                    if max_path_len and len(ent_ids) > max_path_len:
                        continue
                    key = f"{src_e}:{tgt_e}:{block_id}:{rel_text}"
                    if key in seen_semantic_edges:
                        continue
                    seen_semantic_edges.add(key)
                    add_edge_callback(
                        edges,
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

    # 4. Co-occurrence
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
            add_edge_callback(
                edges,
                a,
                "coOccursWith",
                b,
                props={"support": support, "confidence": support},
                meta={"structureType": "Edge", "extractionMethod": "pattern_mining", "blockCount": block_count},
            )

    # 5. Centrality
    if sem_defaults.get("corpus_centrality_algorithm") == "pagerank":
        entity_ids = list(entity_props_by_id.keys())
        neighbors: Dict[str, List[str]] = {eid: [] for eid in entity_ids}
        for e in edges:
            if not isinstance(e, dict):
                continue
            if e.get("relation") not in {"semanticRelation", "coOccursWith"}:
                continue
            s = str(e.get("source") or e.get("source_node") or "")
            t = str(e.get("target") or e.get("target_node") or "")
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
    
    return semantic_doc_profile
