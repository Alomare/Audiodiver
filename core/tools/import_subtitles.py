"""Dev tool: writes which subtitle each voice line says, and names the clips without words, from the S7 spike.

    python core/tools/import_subtitles.py [matches.jsonl]

  matches.jsonl  the S7 spike's result (internal/spikes/s7/out/matches.jsonl; its README says how it is made):
                 every English voice clip, the subtitle it says (Whisper's words matched to the game's subtitles,
                 proven by the clip's length against each language's timing), and for a clip without words a name
                 by what it is ("Grunt 3", from an AudioSet classifier).

It writes audiodiver/data/subtitles.json:

  texts   subtitle id -> its English words (no timing, no markup)
  lines   English Sound object id -> [subtitle id, sure]: the other languages map their Sounds to it by place
          (library.py, _english), so the line is labelled and linked in all of them. sure: 1 where the id is
          certain (the only subtitle with its words, or the clip's length picks it among those that share them), 0
          where it is one of several with the same words
  clips   English source id -> the same, for the clips no Sound in their bank plays
  sounds  "o<Sound id>" or "s<source id>" -> what a clip without words is ("Grunt", "Panting", "Laugh"...); the
          Library numbers them per bank

The clips no Sound in their bank plays are each shared by two Helldiver banks (male1 and purist, female1 and
female2: the same source id, so the same audio): where one bank's match calls such a clip wordless, it is wordless
(the spike lets purist's matches stand on their own, and 24 of them give a breath a subtitle).

A line counts when its words match (proven, likely, or the words alone: a recording longer or shorter than the one
the subtitle is timed from); the weak matches are left out. Needs nothing but the file.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPIKE = ROOT / "internal" / "spikes" / "s7" / "out" / "matches.jsonl"
OUT = ROOT / "core" / "audiodiver" / "data" / "subtitles.json"
TIERS = {"proven": 3, "likely": 2, "words-only": 1}
SURE = 0.99  # the spike's: id_p this high and the id is certain (calibrated in its report)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else SPIKE
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    texts, lines, clips, sounds, rank = {}, {}, {}, {}, {}
    for r in rows:
        keys = [("o", o) for o in r["oids"]] or [("s", r["sid"])]
        if r.get("name"):
            for p, k in keys:
                sounds[f"{p}{k}"] = r["sound"]
            continue
        tier = TIERS.get(r["tier"], 0)
        if not tier or r.get("breath"):
            continue
        texts[str(r["subtitle"])] = r["said"]
        for p, k in keys:  # a Sound two banks share: the better match
            if tier > rank.get((p, k), 0):
                rank[(p, k)] = tier
                (lines if p == "o" else clips)[str(k)] = [r["subtitle"], int(r["id_p"] >= SURE)]
    for k in [k for k in clips if f"s{k}" in sounds]:
        del clips[k]
    out = {"about": "Which subtitle each voice line says, by its English Sound object (the other languages map to it by place) or, for "
                    "a clip no Sound in its bank plays, its English source id; sure: 0 where the line is one of "
                    "several subtitles with the same words. And what each clip without words is. Matched by "
                    "what Whisper heard and the clips' lengths against every language's subtitle timing.",
           "texts": texts, "lines": lines, "clips": clips, "sounds": sounds}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    sure = sum(v[1] for v in [*lines.values(), *clips.values()])
    print(f"{len(lines)} Sounds and {len(clips)} clips say one of {len(texts)} subtitles ({sure} sure of the id); "
          f"{len(sounds)} sounds without words named -> {OUT}")


if __name__ == "__main__":
    main()
