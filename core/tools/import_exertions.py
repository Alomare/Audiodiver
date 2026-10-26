"""Dev tool: names the Helldivers' exertions (the bank Helldiver_Standard_VO) by what they are, from a mod's notes.

    python core/tools/import_exertions.py [notes.txt]

  notes.txt  "EVIL Helldivers Pains and Groans.txt" (kept next to the project, in _examples/): the bank's 27 kinds of
             exertion, each with the clips of four voices, by stream file id.

It writes audiodiver/data/exertions.json in notes.json's shape (catalog.py reads both): per kind and voice, a label
("Drowning · Voice 1"), a note on when it plays, and the clips' source ids. In the bank each kind is one actor-mixer
with a child per voice that holds the takes, so each label names one of the Library's groups.

The notes number the voices as the Library numbers the Helldiver voice banks: voices 1 and 3 are the female ones, 2
and 4 the male ones (checked with a speaker model: internal/docs/history/2026-10-26_27.md), and a recording two kinds
share has the same number in both. Which voice of each pair is which isn't proven. Needs the installed game.
"""
import json
import re
import sys
from pathlib import Path

from audiodiver.game import murmur64_hash
from audiodiver.index import AudioIndex

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
OUT = HERE.parent / "audiodiver" / "data" / "exertions.json"
BANK = murmur64_hash(b"content/audio/Helldiver_Standard_VO")

# the notes' groups: (label, when it plays). Shown texts follow the app's writing rules (app/README.md).
KINDS = {
    "1": ("Drowning", "Plays while a Helldiver drowns."),
    "2": ("Bleeding Out", "Plays while a Helldiver bleeds out from a chest wound."),
    "3": ("Choking", "A choking cough."),
    "4": ("On Fire", "Screams while a Helldiver burns."),
    "4.5": ("This Is Democracy Emote", "Plays with the This Is Democracy emote."),
    "5": ("Heavy Throw", "Plays when throwing something heavy, such as an artillery shell."),
    "6": ("Crawling", "Plays while crawling."),
    "7": ("Hurt, Medium", "Plays on taking moderate damage."),
    "8": ("Long Fall", "Screams while falling from a great height."),
    "9": ("Silo Hatch Locks", "Plays when lifting the locks of a missile silo hatch."),
    "10": ("Grenade Throw", "Plays when throwing a grenade."),
    "11": ("Soft Landing", "Plays on landing softly."),
    "12": ("Death Scream, Short", "A short death scream. Rare."),
    "13": ("Hurt, Minor", "Plays on taking minor damage and on being knocked down."),
    "14": ("Melee", "Plays with a melee attack."),
    "15": ("Death", "Plays on dying."),
    "16": ("Bleeding Out, Second Set", "A second set of sounds for bleeding out. Voices 1, 2 and 4 are the same "
                                       "recordings as in Bleeding Out."),
    "17": ("Vaulting", "Plays when vaulting over an obstacle."),
    "18": ("Stim Relief", "Relief after using a stim."),
    "19": ("Fire Out", "Plays when the flames on a Helldiver go out."),
    "20": ("Coughing", "Plays in gas, and in weather that makes Helldivers cough."),
    "21": ("Death Scream, Long", "A long death scream, heard when dying from a chest wound. Rare."),
    "22": ("Broken Limb", "Plays when walking on a broken leg or aiming with a broken arm."),
    "23": ("Hurt, Major", "Plays on taking heavy damage."),
    "24": ("Dive", "Plays when diving and landing."),
    "25": ("Catching Breath", "Plays when leaving the water after nearly drowning."),
    "26": ("Climbing", "Plays while climbing."),
}


def parse(path: Path) -> list[tuple[str, list[list[int]]]]:
    """[(group, [ids of voice 1, of voice 2, ...])], from the per-group lists after the summary at the top."""
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if i and line.startswith("Group 1 -") and not lines[i + 1].startswith("Group"))
    out = []
    for line in lines[start:]:
        s = line.strip()
        if m := re.match(r"Group ([\d.]+)\b", s):
            out.append((m.group(1), []))
        elif re.match(r"-\s*Voice \d", s):
            out[-1][1].append([])
        elif s.isdigit():
            out[-1][1][-1].append(int(s))
    return out


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "_examples" / "EVIL Helldivers Pains and Groans.txt"
    groups = parse(path)
    assert [g for g, _ in groups] == list(KINDS), f"the notes' groups are {[g for g, _ in groups]}: check KINDS"
    ix = AudioIndex(log=print)
    out, clips = [], 0
    for g, voices in groups:
        label, note = KINDS[g]
        assert len(voices) == 4, f"group {g} has {len(voices)} voices"
        for n, ids in enumerate(voices, 1):
            sources = [ix.resolve(i) for i in ids]  # a stream file id, as the notes give it: the source it streams
            lost = [s for s in sources if BANK not in ix.banks_for(s)]
            assert not lost, f"group {g} voice {n}: {lost} aren't in Helldiver_Standard_VO"
            out.append({"label": f"{label} · Voice {n}", "note": note, "ids": [str(s) for s in sources]})
            clips += len(sources)
    about = ("The Helldivers' exertions (the bank Helldiver_Standard_VO) by kind and voice, in notes.json's shape: "
             "written by tools/import_exertions.py.")
    rows = ",\n".join("    " + json.dumps(g, ensure_ascii=False) for g in out)  # one group a line, as in notes.json
    OUT.write_text(f'{{\n  "about": {json.dumps(about)},\n  "groups": [\n{rows}\n  ]\n}}\n', encoding="utf-8")
    print(f"{len(KINDS)} kinds, {len(out)} groups, {clips} clips -> {OUT}")


if __name__ == "__main__":
    main()
