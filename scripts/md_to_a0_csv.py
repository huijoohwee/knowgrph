import re
import csv
from pathlib import Path

HEADER = [
    "graph_id","domain","category","stage","entity_type","subject","predicate","object","attribute","value","role","action","outcome","challenge","solution","context","source_location","source_type","component_name","operation_name","operation_description","temporal_marker","impact_description","source_reference","metadata_json"
]

def parse_readme(md_path: Path):
    rows = []
    text = md_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    section = None
    seq = 1
    project_subject = "KnowGrph"
    for i, line in enumerate(lines):
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if section == "Core Stack" and line.strip().startswith("-"):
            if line.strip().startswith("---"):
                continue
            item = line.strip()[2:].strip()
            parts = [p.strip() for p in item.split("+")]
            for part in parts:
                label = re.sub(r"\(.+?\)", "", part).strip()
                label = label.replace("**", "").strip()
                rows.append(_row(seq, subject=project_subject, predicate="uses", object=label, category="Core Stack", entity_type="Component"))
                seq += 1
        if section == "FOSS Tools (totally free solutions)":
            m = re.match(r"^\d+\.\s+\*\*(.+?)\*\*", line.strip())
            if m:
                label = m.group(1).strip()
                rows.append(_row(seq, subject=project_subject, predicate="uses", object=label, category="FOSS Tools", entity_type="Component"))
                seq += 1
        if section == "✅ MVP Principles" and line.strip().startswith("-"):
            m = re.match(r"^-\s+\*\*(.+?)\*\*", line.strip())
            if m:
                label = m.group(1).strip()
                rows.append(_row(seq, subject=project_subject, predicate="emphasizes", object=label, category="MVP Principles", entity_type="Process"))
                seq += 1
        if section == "Example Flow":
            if line.strip() == "```text":
                block = []
                j = i + 1
                while j < len(lines) and lines[j].strip() != "```":
                    block.append(lines[j])
                    j += 1
                rows.extend(_parse_flow(block, seq))
                seq = len(rows) + 1
    return rows

def _row(seq, subject, predicate, object, category, entity_type):
    return {
        "graph_id": f"sys:kg_{seq:03d}",
        "domain": "Technology",
        "category": category,
        "stage": "Planning",
        "entity_type": entity_type,
        "subject": subject,
        "predicate": predicate,
        "object": object,
        "attribute": "",
        "value": "",
        "role": "",
        "action": "",
        "outcome": "",
        "challenge": "",
        "solution": "",
        "context": "",
        "source_location": "README.md",
        "source_type": "Documentation",
        "component_name": "",
        "operation_name": "",
        "operation_description": "",
        "temporal_marker": "",
        "impact_description": "",
        "source_reference": "",
        "metadata_json": "{}",
    }

def _parse_flow(block_lines, start_seq):
    rows = []
    seq = start_seq
    def chain(line):
        parts = [p.strip() for p in line.split("→")]
        return [p for p in parts if p]
    for line in block_lines:
        if "→" in line:
            parts = chain(line)
            for a, b in zip(parts, parts[1:]):
                rows.append(_row(seq, subject=a, predicate="transforms_to", object=b, category="Flow", entity_type="Process"))
                seq += 1
    return rows

def write_csv(rows, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        for r in rows:
            w.writerow(r)

def main():
    repo = Path(__file__).resolve().parents[1]
    md_path = repo / "README.md"
    out_csv = repo / "data" / "outputs" / "a0.csv"
    rows = parse_readme(md_path)
    write_csv(rows, out_csv)

if __name__ == "__main__":
    main()
