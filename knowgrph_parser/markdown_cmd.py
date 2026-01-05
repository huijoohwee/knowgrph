import argparse
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .common import (
    DEFAULT_AGENTIC_RAG_CONTEXT_URL,
    DEFAULT_AGENTIC_RAG_SCHEMA_URL,
    DEFAULT_TERM_IRI_BASE,
    find_repo_root,
    slugify,
    write_json,
    write_text,
)
from .doc_markdown import build_knowgrph_doc_markdown
from .markdown_graph import parse_markdown_to_graph_jsonld
from .orchestrator_yaml import build_orchestrator_config_yaml
from .schema_config import build_schema_config_jsonld


def main(argv: Optional[Sequence[str]] = None, *, parser_script_path: Optional[str] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input markdown file")
    parser.add_argument("--output-graph", default="", help="Path to output graph JSON-LD file")
    parser.add_argument("--output-schema", default="", help="Path to output schema JSON-LD file")
    parser.add_argument("--output-orchestrator", default="", help="Path to output orchestrator YAML file")
    parser.add_argument("--output-doc", default="", help="Path to output generated markdown document")
    parser.add_argument(
        "--output-dir",
        default="",
        help="Optional directory for output artifacts; defaults to data/<stem_YYYYMMDDHHMM> under repo root",
    )
    parser.add_argument("--graph-id", default="", help="Graph id to embed into metadata")
    parser.add_argument("--codebase-root", default="", help="Optional repo/codebase root used for relative paths")
    parser.add_argument(
        "--agenticrag-schema",
        default=DEFAULT_AGENTIC_RAG_SCHEMA_URL,
        help="AgenticRAG schema IRI to record in generated metadata and orchestrator config",
    )
    parser.add_argument(
        "--agenticrag-context",
        default=DEFAULT_AGENTIC_RAG_CONTEXT_URL,
        help="AgenticRAG JSON-LD @context IRI to use as @vocab",
    )
    parser.add_argument(
        "--term-iri-base",
        default=DEFAULT_TERM_IRI_BASE,
        help="Base IRI for Knowgrph relationship terms (e.g. hasSection, next)",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    input_path = os.path.abspath(args.input)
    root = os.path.abspath(args.codebase_root) if args.codebase_root.strip() else find_repo_root(input_path)
    stem = os.path.splitext(os.path.basename(input_path))[0]
    gid = args.graph_id.strip() if args.graph_id.strip() else f"md:{slugify(stem)}"

    graph_doc = parse_markdown_to_graph_jsonld(
        input_path,
        codebase_root=root,
        graph_id=gid,
        agentic_rag_schema_url=str(args.agenticrag_schema or DEFAULT_AGENTIC_RAG_SCHEMA_URL),
        agentic_rag_context_url=str(args.agenticrag_context or DEFAULT_AGENTIC_RAG_CONTEXT_URL),
        term_iri_base=str(args.term_iri_base or DEFAULT_TERM_IRI_BASE),
    )
    schema_doc = build_schema_config_jsonld(
        graph_doc,
        agentic_rag_schema_url=str(args.agenticrag_schema or DEFAULT_AGENTIC_RAG_SCHEMA_URL),
        term_iri_base=str(args.term_iri_base or DEFAULT_TERM_IRI_BASE),
    )

    ts = datetime.utcnow().strftime("%Y%m%d%H%M")
    default_dir = os.path.join(root, "data", f"{stem}_{ts}")
    output_dir = os.path.abspath(args.output_dir) if args.output_dir.strip() else default_dir
    os.makedirs(output_dir, exist_ok=True)

    raw_graph_out = str(args.output_graph or "").strip()
    raw_schema_out = str(args.output_schema or "").strip()
    raw_orch_out = str(args.output_orchestrator or "").strip()
    raw_doc_out = str(args.output_doc or "").strip()

    graph_out_path = os.path.abspath(raw_graph_out) if raw_graph_out else os.path.abspath(
        os.path.join(output_dir, f"{stem}-graph-data.jsonld")
    )
    schema_out_path = os.path.abspath(raw_schema_out) if raw_schema_out else os.path.abspath(
        os.path.join(output_dir, f"{stem}-schema-config.jsonld")
    )
    orch_out_path = os.path.abspath(raw_orch_out) if raw_orch_out else os.path.abspath(
        os.path.join(output_dir, f"{stem}-orchestrator-config.yaml")
    )
    doc_out_path = os.path.abspath(raw_doc_out) if raw_doc_out else os.path.abspath(
        os.path.join(output_dir, f"{stem}-document.md")
    )

    sections: List[Tuple[int, str, str]] = []
    top_ids: List[str] = []
    top_titles: List[str] = []
    for item in graph_doc.get("@graph", []):
        if not isinstance(item, dict):
            continue
        if item.get("@type") != "Section":
            continue
        props = item.get("properties")
        props_dict: Dict[str, Any] = props if isinstance(props, dict) else {}
        level = props_dict.get("level")
        heading = props_dict.get("heading")
        anchor = props_dict.get("anchor")
        if isinstance(level, int) and isinstance(heading, str) and isinstance(anchor, str):
            sections.append((level, heading, anchor))
            if level == 1:
                sid = item.get("@id")
                if isinstance(sid, str) and sid.strip():
                    top_ids.append(sid.strip())
                top_titles.append(heading)

    parser_entrypoint = (
        os.path.abspath(parser_script_path)
        if parser_script_path and parser_script_path.strip()
        else "python -m knowgrph_parser"
    )
    orch_text = build_orchestrator_config_yaml(
        repo_root=root,
        graph_id=gid,
        graph_jsonld_path=graph_out_path,
        schema_jsonld_path=schema_out_path,
        parser_entrypoint=parser_entrypoint,
        markdown_path=input_path,
        top_section_ids=top_ids,
        top_section_titles=top_titles,
        agentic_rag_schema_url=str(args.agenticrag_schema or DEFAULT_AGENTIC_RAG_SCHEMA_URL),
    )

    title = ""
    for item in graph_doc.get("@graph", []):
        if isinstance(item, dict) and item.get("@type") == "Document":
            title = str(item.get("name") or "")
            break
    if not title:
        title = os.path.basename(input_path)

    doc_text = build_knowgrph_doc_markdown(
        title=title,
        graph_id=gid,
        markdown_path=input_path,
        graph_jsonld_path=graph_out_path,
        schema_jsonld_path=schema_out_path,
        orchestrator_yaml_path=orch_out_path,
        sections=sections,
    )

    parser_script_path = os.path.join(output_dir, f"parse_{stem}.py")
    parser_script = (
        "import os\n"
        "import sys\n\n"
        "from knowgrph_parser import markdown_cmd\n\n"
        "def main() -> int:\n"
        f"    markdown_path = os.path.abspath({repr(input_path)})\n"
        "    argv = ['--input', markdown_path] + sys.argv[1:]\n"
        "    return markdown_cmd.main(argv)\n\n"
        "if __name__ == '__main__':\n"
        "    raise SystemExit(main())\n"
    )

    write_json(graph_out_path, graph_doc)
    write_json(schema_out_path, schema_doc)
    write_text(orch_out_path, orch_text)
    write_text(doc_out_path, doc_text)
    write_text(parser_script_path, parser_script)

    return 0
