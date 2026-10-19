"""Dev tool: refreshes audiodiver/data/names.json (cracked Wwise names, spike S3) and labels.json (the community
spreadsheet's descriptions, keyed by WEM resource id, source id or music object id).

    python core/tools/import_knowledge.py [spreadsheet.xlsx] [names_out.json]
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
DATA = HERE.parent / "audiodiver" / "data"
# spike S3 (the Wwise name cracking) is internal development material, kept out of the public repository
S3 = next((d for d in (ROOT / "internal" / "spikes" / "s3", ROOT / "spikes" / "s3") if d.is_dir()), ROOT / "internal" / "spikes" / "s3")
sys.path.insert(0, str(S3))


def main():
    sheet = sys.argv[1] if len(sys.argv) > 1 else str(ROOT.parent / "_examples" / "Helldivers 2 Music Stuff.xlsx")
    names_out = Path(sys.argv[2] if len(sys.argv) > 2 else S3 / "names_out.json")
    names = {h: n for h, (n, conf) in json.loads(names_out.read_text()).items() if conf in ("exact", "dict")}
    (DATA / "names.json").write_text(json.dumps(dict(sorted(names.items(), key=lambda kv: int(kv[0]))), indent=0))

    import cuemap  # spike S3's spreadsheet reader
    cuemap.SHEET = sheet
    labels = {}
    for i, ls in sorted(cuemap.spreadsheet_labels().items()):
        seen = []
        for _sheet, label in ls:
            if label not in seen:
                seen.append(label)
        labels[str(i)] = seen
    (DATA / "labels.json").write_text(json.dumps(labels, indent=0, ensure_ascii=False), encoding="utf-8")
    print(f"{len(names)} names, {len(labels)} labelled ids")


if __name__ == "__main__":
    main()
