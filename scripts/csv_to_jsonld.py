import csv
import json
from pathlib import Path

CONTEXT = {
    "@vocab": "https://huijoohwee.github.io/schema/vocab.jsonld",
    "id": "@id",
    "type": "@type",
    "subject": "subject",
    "predicate": "predicate",
    "object": "object",
    "domain": "domain",
    "category": "category",
    "stage": "stage",
    "attribute": "attribute",
    "value": "value",
    "role": "role",
    "action": "action",
    "outcome": "outcome",
    "challenge": "challenge",
    "solution": "solution",
    "context": "context",
    "source_location": "source_location",
    "source_type": "source_type",
    "component_name": "component_name",
    "operation_name": "operation_name",
    "operation_description": "operation_description",
    "temporal_marker": "temporal_marker",
    "impact_description": "impact_description",
    "source_reference": "source_reference",
    "metadata_json": "metadata_json",
}

def convert(csv_path: Path, out_path: Path):
    nodes = []
    with csv_path.open("r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            node = {
                "id": row["graph_id"],
                "type": row["entity_type"],
                "subject": row["subject"],
                "predicate": row["predicate"],
                "object": row["object"],
            }
            for k in ["domain","category","stage","attribute","value","role","action","outcome","challenge","solution","context","source_location","source_type","component_name","operation_name","operation_description","temporal_marker","impact_description","source_reference","metadata_json"]:
                if row.get(k):
                    node[k] = row[k]
            nodes.append(node)
    doc = {"@context": CONTEXT, "@graph": nodes}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

def main():
    repo = Path(__file__).resolve().parents[1]
    csv_path = repo / "data" / "outputs" / "a0.csv"
    out_path = repo / "data" / "outputs" / "a0.jsonld"
    convert(csv_path, out_path)

if __name__ == "__main__":
    main()

