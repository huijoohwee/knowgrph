import os
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


def ingest_jsonld_to_duckdb(jsonld_path: str, db_path: str) -> str:
    if duckdb is None:
        raise RuntimeError("duckdb package is not installed")
    import json

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


def ingest_example_index_to_duckdb() -> str:
    index_path = os.path.join(
        BASE_DIR,
        "data",
        "outputs",
        "example-codebase-index-viz.jsonld",
    )
    db_path = os.path.join(
        BASE_DIR,
        "data",
        "outputs",
        "example-codebase-index.duckdb",
    )
    if not os.path.exists(index_path):
        raise FileNotFoundError(index_path)
    return ingest_jsonld_to_duckdb(index_path, db_path)


def load_example_duckdb_queries(config_path: str) -> List[Dict[str, Any]]:
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


def get_example_duckdb_query_by_id(preset_id: str, config_path: str) -> Dict[str, Any]:
    queries = load_example_duckdb_queries(config_path)
    for entry in queries:
        entry_id = entry.get("id")
        if isinstance(entry_id, str) and entry_id == preset_id:
            return entry
    available_ids = [str(entry.get("id")) for entry in queries if isinstance(entry.get("id"), str)]
    raise KeyError(
        f"Unknown DuckDB query preset id '{preset_id}'. Available ids: {', '.join(available_ids) or '(none)'}"
    )


def run_example_duckdb_query(
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
            "example-codebase-config.yaml",
        )
    query_spec = get_example_duckdb_query_by_id(preset_id, config_path)
    sql_value = query_spec.get("sql")
    if not isinstance(sql_value, str) or not sql_value.strip():
        raise ValueError(f"Preset '{preset_id}' in {config_path} does not define a non-empty sql field")
    sql_text = sql_value
    if db_path is None:
        db_path = os.path.join(
            BASE_DIR,
            "data",
            "outputs",
            "example-codebase-index.duckdb",
        )
    if not os.path.exists(db_path):
        db_path = ingest_example_index_to_duckdb()
    connection = duckdb.connect(db_path)
    try:
        cursor = connection.execute(sql_text)
        rows = cursor.fetchall()
        description = cursor.description or []
        columns = [col[0] for col in description]
    finally:
        connection.close()
    return columns, rows


def run_example_duckdb_query_cli(
    preset_id: str,
    config_path: str | None = None,
    db_path: str | None = None,
) -> None:
    columns, rows = run_example_duckdb_query(preset_id, config_path=config_path, db_path=db_path)
    if columns:
        print("\t".join(columns))
    for row in rows:
        values = ["" if value is None else str(value) for value in row]
        print("\t".join(values))

