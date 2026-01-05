import argparse
import csv
import json
import os
import subprocess
import time
from typing import Any, Dict, List, Tuple

try:
    import duckdb  # type: ignore
except Exception:
    duckdb = None

try:
    import yaml  # type: ignore
except Exception:
    yaml = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_INPUT_PATH = os.getenv(
    "KG_INPUT_PATH",
    os.path.join(BASE_DIR, "canvas", "public", "unicorn-investors-test.json"),
)
DEFAULT_OUTPUT_DIR = os.getenv(
    "KG_OUTPUT_DIR",
    os.path.join(BASE_DIR, "data", "outputs"),
)
DEFAULT_EMBEDDINGS_BACKEND_FILE = os.path.join(
    BASE_DIR,
    "knowgrph_parser",
    "codebase-index-embeddings-example.json",
)

CODEBASE_INDEX_ORCHESTRATOR_CONFIG_REL = os.getenv(
    "KG_CODEBASE_INDEX_ORCHESTRATOR_CONFIG",
    "orchestrator-config/knowgrph-universal-orchestrator-config.yaml",
)
CODEBASE_INDEX_JSONLD_REL = os.getenv(
    "KG_CODEBASE_INDEX_JSONLD_PATH",
    "data/outputs/codebase-index-viz.jsonld",
)


def load_graph(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        data: Any = json.load(handle)
    return data if isinstance(data, dict) else {}


def ensure_output_dir(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)


def append_runtime_event(
    runtime_events_log_path: str,
    key: str,
    node_id: str,
    event_type: str,
    status: str,
    duration_ms: float,
    stack_trace_snippet: str = "",
) -> None:
    try:
        os.makedirs(os.path.dirname(runtime_events_log_path), exist_ok=True)
        payload: Dict[str, Any] = {
            "key": key,
            "node_id": node_id,
            "eventType": event_type,
            "status": status,
            "durationMs": float(duration_ms),
        }
        if stack_trace_snippet:
            payload["stackTraceSnippet"] = stack_trace_snippet
        with open(runtime_events_log_path, "a", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
            handle.write("\n")
    except Exception:
        return


def write_a0_csv(output_dir: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> str:
    csv_path = os.path.join(output_dir, "a0.csv")
    fields = [
        "subject_id",
        "subject_type",
        "subject_name",
        "predicate",
        "object_id",
        "object_type",
        "object_name",
        "weight",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for node in nodes:
            node_id = node.get("id")
            data = node.get("data", {}) or {}
            node_type = data.get("type")
            node_name = data.get("name") or node_id
            writer.writerow(
                {
                    "subject_id": node_id,
                    "subject_type": node_type,
                    "subject_name": node_name,
                    "predicate": "hasName",
                    "object_id": "",
                    "object_type": "Literal",
                    "object_name": node_name,
                    "weight": "",
                }
            )
            writer.writerow(
                {
                    "subject_id": node_id,
                    "subject_type": node_type,
                    "subject_name": node_name,
                    "predicate": "hasType",
                    "object_id": node_type,
                    "object_type": "Class",
                    "object_name": node_type,
                    "weight": "",
                }
            )
        for edge in edges:
            edge_data = edge.get("data", {}) or {}
            predicate = "investsIn" if edge_data.get("type") == "Investor" else (edge_data.get("type") or "relatedTo")
            writer.writerow(
                {
                    "subject_id": edge.get("source"),
                    "subject_type": "",
                    "subject_name": "",
                    "predicate": predicate,
                    "object_id": edge.get("target"),
                    "object_type": "",
                    "object_name": "",
                    "weight": str(edge_data.get("weight", "")),
                }
            )
    return csv_path


def write_jsonld(output_dir: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> str:
    context = {
        "@vocab": "https://huijoohwee.github.io/knowgrph#",
        "name": "https://huijoohwee.github.io/knowgrph#name",
        "investsIn": {"@id": "https://huijoohwee.github.io/knowgrph#investsIn", "@type": "@id"},
        "weight": "https://huijoohwee.github.io/knowgrph#weight",
    }
    id_to_node: Dict[str, Dict[str, Any]] = {}
    for node in nodes:
        node_id = node.get("id")
        if isinstance(node_id, str) and node_id:
            id_to_node[node_id] = node
    out_nodes: List[Dict[str, Any]] = []
    outgoing: Dict[str, List[str]] = {}
    for edge in edges:
        edge_data = edge.get("data", {}) or {}
        source = edge.get("source")
        target = edge.get("target")
        if edge_data.get("type") == "Investor" and isinstance(source, str) and isinstance(target, str):
            bucket = outgoing.setdefault(source, [])
            bucket.append(target)
    for node_id, node in id_to_node.items():
        data = node.get("data", {}) or {}
        node_type = data.get("type") or "Entity"
        node_name = data.get("name") or node_id
        obj: Dict[str, Any] = {
            "@id": f"kg:{node_id}",
            "@type": node_type,
            "name": node_name,
        }
        if node_id in outgoing:
            obj["investsIn"] = [f"kg:{target}" for target in outgoing[node_id]]
        out_nodes.append(obj)
    document = {"@context": context, "@graph": out_nodes}
    jsonld_path = os.path.join(output_dir, "a0.jsonld")
    with open(jsonld_path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)
    return jsonld_path


def ingest_jsonld_to_duckdb(jsonld_path: str, db_path: str) -> str:
    if duckdb is None:
        raise RuntimeError("duckdb package is not installed")
    with open(jsonld_path, "r", encoding="utf-8") as handle:
        payload: Any = json.load(handle)
    graph = payload.get("@graph") or []
    if not isinstance(graph, list):
        graph = []
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    connection = duckdb.connect(db_path)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, type TEXT, name TEXT, path TEXT, chunk_text TEXT, metadata JSON)"
    )
    connection.execute("CREATE TABLE IF NOT EXISTS edges (subject_id TEXT, predicate TEXT, object_id TEXT)")
    connection.execute("DELETE FROM edges")
    connection.execute("DELETE FROM nodes")
    for entry in graph:
        if not isinstance(entry, dict):
            continue
        node_id = entry.get("@id")
        node_type = entry.get("@type")
        node_name = entry.get("name")
        node_path = entry.get("path")
        chunk_text = entry.get("chunk_text")
        metadata = entry.get("metadata") or {}
        if not isinstance(node_id, str) or not node_id:
            continue
        if not isinstance(node_type, str) or not node_type:
            node_type = "Entity"
        if not isinstance(node_name, str) or not node_name:
            node_name = node_id
        if not isinstance(node_path, str):
            node_path = None
        if not isinstance(chunk_text, str):
            chunk_text = None
        if not isinstance(metadata, dict):
            metadata = {}
        connection.execute(
            "INSERT INTO nodes (id, type, name, path, chunk_text, metadata) VALUES (?, ?, ?, ?, ?, ?)",
            [node_id, node_type, node_name, node_path, chunk_text, json.dumps(metadata)],
        )
    skip_keys = {"@id", "@type", "name", "path", "labels", "properties", "graphRAGPath", "chunk_text", "embedding", "metadata"}
    for entry in graph:
        if not isinstance(entry, dict):
            continue
        node_id = entry.get("@id")
        if not isinstance(node_id, str) or not node_id:
            continue
        for key, value in entry.items():
            if key in skip_keys:
                continue
            if not isinstance(key, str) or not key:
                continue
            targets: List[Any]
            if isinstance(value, list):
                targets = value
            else:
                targets = [value]
            for target in targets:
                if not isinstance(target, str):
                    continue
                if not target:
                    continue
                connection.execute(
                    "INSERT INTO edges (subject_id, predicate, object_id) VALUES (?, ?, ?)",
                    [node_id, key, target],
                )
    connection.close()
    return db_path


def run_codebase_index_pipeline(output_dir: str, runtime_events_log_path: str) -> Tuple[str, str]:
    orchestrator_config = os.path.join(BASE_DIR, CODEBASE_INDEX_ORCHESTRATOR_CONFIG_REL)
    index_path = os.path.join(BASE_DIR, CODEBASE_INDEX_JSONLD_REL)
    embeddings_example = os.getenv("KG_EMBEDDINGS_BACKEND_FILE", DEFAULT_EMBEDDINGS_BACKEND_FILE)
    started = time.perf_counter()
    status = "ok"
    try:
        subprocess.run(
            [
                "python",
                "-m",
                "knowgrph_parser",
                "parse-codebase-index",
                "-c",
                orchestrator_config,
            ],
            check=True,
        )
    except subprocess.CalledProcessError:
        status = "error"
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000.0
        append_runtime_event(
            runtime_events_log_path,
            "runtime:event:knowgrph_parser:pipeline",
            "knowgrph_parser/pipeline_cmd.py",
            "call",
            status,
            duration_ms,
            "knowgrph_parser/pipeline_cmd.py: run_codebase_index_pipeline",
        )
    subprocess.run(
        [
            "python",
            "-m",
            "knowgrph_parser",
            "embed-codebase-index",
            "--backend",
            "file",
            "--backend-file",
            embeddings_example,
            "--dimensions",
            "4",
        ],
        check=True,
    )
    subprocess.run(
        [
            "python",
            "-m",
            "knowgrph_parser",
            "test-embedding-sanity",
            "--dimensions",
            "4",
        ],
        check=True,
    )
    return orchestrator_config, index_path


def ingest_aiap22_index_to_duckdb() -> str:
    index_path = os.path.join(
        BASE_DIR,
        "data",
        "outputs",
        "aiap22-codebase-index-viz.jsonld",
    )
    db_path = os.path.join(
        BASE_DIR,
        "data",
        "outputs",
        "aiap22-codebase-index.duckdb",
    )
    if not os.path.exists(index_path):
        raise FileNotFoundError(index_path)
    return ingest_jsonld_to_duckdb(index_path, db_path)


def load_aiap22_duckdb_queries(config_path: str) -> List[Dict[str, Any]]:
    if not yaml:
        return []
    try:
        with open(config_path, "r", encoding="utf-8") as handle:
            data: Any = yaml.safe_load(handle) or {}
    except Exception:
        return []
    if not isinstance(data, dict):
        return []
    raw_queries = data.get("duckdb_queries") or []
    if not isinstance(raw_queries, list):
        return []
    queries: List[Dict[str, Any]] = []
    for entry in raw_queries:
        if isinstance(entry, dict) and isinstance(entry.get("id"), str):
            queries.append(entry)
    return queries


def get_aiap22_duckdb_query_by_id(preset_id: str, config_path: str) -> Dict[str, Any]:
    queries = load_aiap22_duckdb_queries(config_path)
    for entry in queries:
        entry_id = entry.get("id")
        if isinstance(entry_id, str) and entry_id == preset_id:
            return entry
    available_ids = [str(entry.get("id")) for entry in queries if isinstance(entry.get("id"), str)]
    raise KeyError(
        f"Unknown AIAP22 DuckDB query preset id '{preset_id}'. Available ids: {', '.join(available_ids) or '(none)'}"
    )


def run_aiap22_duckdb_query(
    preset_id: str,
    config_path: str | None = None,
    db_path: str | None = None,
) -> Tuple[List[str], List[Tuple[Any, ...]]]:
    if duckdb is None:
        raise RuntimeError("duckdb package is not installed")
    if config_path is None:
        config_path = os.path.join(
            BASE_DIR,
            "configs",
            "graphrag",
            "aiap22-codebase-config.yaml",
        )
    query_spec = get_aiap22_duckdb_query_by_id(preset_id, config_path)
    sql_value = query_spec.get("sql")
    if not isinstance(sql_value, str) or not sql_value.strip():
        raise ValueError(f"Preset '{preset_id}' in {config_path} does not define a non-empty sql field")
    sql_text = sql_value
    if db_path is None:
        db_path = os.path.join(
            BASE_DIR,
            "data",
            "outputs",
            "aiap22-codebase-index.duckdb",
        )
    if not os.path.exists(db_path):
        db_path = ingest_aiap22_index_to_duckdb()
    connection = duckdb.connect(db_path)
    try:
        cursor = connection.execute(sql_text)
        rows = cursor.fetchall()
        description = cursor.description or []
        columns = [col[0] for col in description]
    finally:
        connection.close()
    return columns, rows


def run_aiap22_duckdb_query_cli(
    preset_id: str,
    config_path: str | None = None,
    db_path: str | None = None,
) -> None:
    columns, rows = run_aiap22_duckdb_query(preset_id, config_path=config_path, db_path=db_path)
    if columns:
        print("\t".join(columns))
    for row in rows:
        values = ["" if value is None else str(value) for value in row]
        print("\t".join(values))


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline", add_help=True)
    parser.add_argument(
        "--mode",
        choices=["pipeline", "aiap22-query"],
        default="pipeline",
    )
    parser.add_argument("--preset-id")
    parser.add_argument("--config", dest="config_path")
    parser.add_argument("--db", dest="db_path")
    arguments = parser.parse_args(list(argv) if argv is not None else None)

    input_path = os.getenv("KG_INPUT_PATH", DEFAULT_INPUT_PATH)
    output_dir = os.getenv("KG_OUTPUT_DIR", DEFAULT_OUTPUT_DIR)
    runtime_events_log_path = os.path.join(output_dir, "runtime-events.jsonl")

    if arguments.mode == "pipeline":
        ensure_output_dir(output_dir)
        data = load_graph(input_path)
        nodes = data.get("nodes", []) or []
        edges = data.get("edges", []) or []
        write_a0_csv(output_dir, nodes, edges)
        write_jsonld(output_dir, nodes, edges)
        run_codebase_index_pipeline(output_dir, runtime_events_log_path)
        return 0

    if arguments.mode == "aiap22-query":
        if not arguments.preset_id:
            raise SystemExit("Missing --preset-id for --mode aiap22-query")
        run_aiap22_duckdb_query_cli(
            arguments.preset_id,
            config_path=arguments.config_path,
            db_path=arguments.db_path,
        )
        return 0

    raise SystemExit(f"Unknown mode: {arguments.mode}")
