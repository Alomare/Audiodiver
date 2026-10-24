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
sys.path.insert(0, str(HERE.parent))
from audiodiver.game import stream_id  # noqa: E402

# the workbook's sheet that lists every id with its category ("Terminid Combat Music") or a guess marked "(?)"; a
# guess gives way where a clip's own sheet (Hellpod Cues, Extraction Cues...) names the clip
FLAT = "Entry List"
# labels the workbook puts on clips that play somewhere else, checked against the cue map
WRONG = {
    600528189124694260: {"Mission End - Stats Screen"},  # Picking loadout #13 (a stray row of the flat list)
    2804501959320279547: {"Automaton Combat Music", "Calm"},  # the death music of every faction
}


def main():
    sheet = sys.argv[1] if len(sys.argv) > 1 else str(ROOT.parent / "_examples" / "Helldivers 2 Music Stuff.xlsx")
    names_out = Path(sys.argv[2] if len(sys.argv) > 2 else S3 / "names_out.json")
    names = {h: n for h, (n, conf) in json.loads(names_out.read_text()).items() if conf in ("exact", "dict")}
    (DATA / "names.json").write_text(json.dumps(dict(sorted(names.items(), key=lambda kv: int(kv[0]))), indent=0))
    print(f"{len(names)} names, {refresh_labels(sheet)} labelled ids")


def refresh_labels(sheet) -> int:
    """Writes labels.json from the workbook; returns how many ids it labels."""
    import cuemap  # spike S3's spreadsheet reader
    cuemap.SHEET = sheet
    found = cuemap.spreadsheet_labels()
    # a clip is labelled by its source id, its stream id, or both
    specific = {i for i, ls in found.items() if any(s != FLAT for s, _ in ls)}
    labels = {}
    for i, ls in sorted(found.items()):
        seen = []
        for s, label in ls:
            if label in WRONG.get(i, ()):
                continue
            if s == FLAT and "(?)" in label and (i in specific or (i < 1 << 32 and stream_id(i) in specific)):
                continue
            if label not in seen:
                seen.append(label)
        if seen:
            labels[str(i)] = seen
    (DATA / "labels.json").write_text(json.dumps(labels, indent=0, ensure_ascii=False), encoding="utf-8")
    return len(labels)


if __name__ == "__main__":
    main()
