from typing import Any, Dict, List

from .common import (
    DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    DEFAULT_TERM_IRI_BASE,
    infer_json_type,
    merge_prop_types,
    slugify,
)


def build_schema_config_jsonld(
    graph_jsonld: Dict[str, Any],
    *,
    agentic_rag_schema_url: str = DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    term_iri_base: str = DEFAULT_TERM_IRI_BASE,
) -> Dict[str, Any]:
    graph = graph_jsonld.get("@graph")
    items = graph if isinstance(graph, list) else []

    node_types: List[str] = []
    edge_labels: List[str] = []
    seen_node_types: set = set()
    seen_edge_labels: set = set()

    prop_types_by_owner: Dict[str, Dict[str, str]] = {}
    edge_prop_types_by_label: Dict[str, Dict[str, str]] = {}

    for item in items:
        if not isinstance(item, dict):
            continue
        if str(item.get("@type") or "") == "knowgrph:Edge" or (
            "source_node" in item and "target_node" in item and "relation" in item
        ):
            lbl = str(item.get("relation") or "").strip()
            if lbl and lbl not in seen_edge_labels:
                seen_edge_labels.add(lbl)
                edge_labels.append(lbl)
            props_raw = item.get("properties")
            props = props_raw if isinstance(props_raw, dict) else {}
            for k, v in props.items():
                inferred = infer_json_type(v)
                if lbl not in edge_prop_types_by_label:
                    edge_prop_types_by_label[lbl] = {}
                prev = edge_prop_types_by_label[lbl].get(k)
                edge_prop_types_by_label[lbl][k] = inferred if not prev else merge_prop_types(prev, inferred)
            continue
        t = item.get("@type")
        if isinstance(t, list) and t:
            t = t[0]
        typ = str(t or "").strip() or "Thing"
        if typ not in seen_node_types:
            seen_node_types.add(typ)
            node_types.append(typ)

        owner = typ
        props: Dict[str, Any] = {}
        if "chunk_text" in item:
            props["chunk_text"] = item.get("chunk_text")
        props_raw = item.get("properties")
        if isinstance(props_raw, dict):
            props.update(props_raw)
        for k, v in props.items():
            inferred = infer_json_type(v)
            if owner not in prop_types_by_owner:
                prop_types_by_owner[owner] = {}
            prev = prop_types_by_owner[owner].get(k)
            prop_types_by_owner[owner][k] = inferred if not prev else merge_prop_types(prev, inferred)

    graph_out: List[Dict[str, Any]] = []
    for nt in node_types:
        graph_out.append({"@id": f"kg:class:{slugify(nt)}", "@type": "kg:NodeType", "name": nt})
    for el in edge_labels:
        graph_out.append({"@id": f"kg:prop:{slugify(el)}", "@type": "kg:EdgeLabel", "name": el})

    for owner, props in prop_types_by_owner.items():
        for key, rng in sorted(props.items(), key=lambda kv: kv[0]):
            graph_out.append(
                {
                    "@id": f"kg:prop:{slugify(owner)}:{slugify(key)}",
                    "@type": "kg:Property",
                    "name": key,
                    "owner": owner,
                    "range": rng,
                }
            )

    for owner, props in edge_prop_types_by_label.items():
        for key, rng in sorted(props.items(), key=lambda kv: kv[0]):
            graph_out.append(
                {
                    "@id": f"kg:prop:{slugify(owner)}:{slugify(key)}",
                    "@type": "kg:Property",
                    "name": key,
                    "owner": owner,
                    "range": rng,
                }
            )

    return {
        "@context": {
            "@vocab": term_iri_base,
            "kg": "http://example.org/kg#",
            "schema": "https://schema.org/",
            "name": "schema:name",
            "owner": "schema:domainIncludes",
            "range": "schema:rangeIncludes",
        },
        "@graph": graph_out,
        "metadata": {
            "agenticRagSchema": agentic_rag_schema_url,
            "generatedBy": "knowgrph_parser.schema_config",
        },
    }
