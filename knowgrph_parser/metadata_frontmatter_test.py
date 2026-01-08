import os

from .graph_builder import parse_markdown_to_graph_jsonld


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    path = os.path.join(root, "docs", "documents", "knowgrph-pipeline-document.md")
    doc = parse_markdown_to_graph_jsonld(path, codebase_root=root)
    meta = doc.get("metadata") or {}
    if "ontologies" not in meta:
        raise SystemExit("metadata.ontologies missing")
    if "polygonLayers" not in meta:
        raise SystemExit("metadata.polygonLayers missing")

    ontologies = meta["ontologies"]
    polygon_layers = meta["polygonLayers"]

    if not isinstance(ontologies, list):
        raise SystemExit("metadata.ontologies is not a list")
    if not isinstance(polygon_layers, list):
        raise SystemExit("metadata.polygonLayers is not a list")

    expected_ontologies = [
        {"prefix": "prov", "iri": "http://www.w3.org/ns/prov#"},
        {"prefix": "mex", "iri": "http://mex.aksw.org/mex-core#"},
        {"prefix": "pplan", "iri": "http://purl.org/net/p-plan#"},
        {"prefix": "mls", "iri": "http://www.w3.org/ns/mls#"},
        {"prefix": "geo", "iri": "http://www.opengis.net/ont/geosparql#"},
        {"prefix": "ro", "iri": "https://w3id.org/ro/crate#"},
    ]
    if len(ontologies) != len(expected_ontologies):
        raise SystemExit(f"metadata.ontologies length {len(ontologies)} != {len(expected_ontologies)}")
    for idx, expected in enumerate(expected_ontologies):
        actual = ontologies[idx]
        if not isinstance(actual, dict):
            raise SystemExit(f"metadata.ontologies[{idx}] is not an object")
        if actual.get("prefix") != expected["prefix"] or actual.get("iri") != expected["iri"]:
            raise SystemExit(
                f"metadata.ontologies[{idx}] mismatch: "
                f"expected prefix={expected['prefix']} iri={expected['iri']}, "
                f"got prefix={actual.get('prefix')} iri={actual.get('iri')}"
            )

    expected_polygon_layers = [
        "competencyHyperspace",
        "performanceSpace",
        "classDistributionSpace",
        "preprocessingCluster",
        "modelTypeClusters",
        "kpiViolationRegion",
        "candidateClusters",
        "assessmentRegion",
    ]
    if polygon_layers != expected_polygon_layers:
        raise SystemExit(f"metadata.polygonLayers mismatch: expected {expected_polygon_layers}, got {polygon_layers}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
