"""The core's translation catalogs (audiodiver/locale/<language>.po).

  python tools/i18n.py extract [language ...]   collects the messages in tr(), N_() and ntr() from audiodiver/*.py
                                                into every catalog (and new ones for the languages named), keeping
                                                the translations made and dropping messages no longer in the code
  python tools/i18n.py stats                    messages and missing translations per catalog
  python tools/i18n.py missing <language> [out] the messages without a translation, as JSON
  python tools/i18n.py fill <language> <json>   writes {msgid: translation} into the catalog (a count: a list of forms)

  python tools/i18n.py data                     collects the texts the data files give the app into
                                                audiodiver/locale/data/en.json, {text: [where it comes from]}
  python tools/i18n.py data-missing <language> [out]   the data texts without a translation, as {text: [where]}
  python tools/i18n.py data-fill <language> <json>     writes {text: translation} into locale/data/<language>.json

A message is the string literal itself, so it is written whole in the call: tr("No project open"), or with named
fields filled after it, tr("No slot {sid}").format(sid=sid). F-strings can't be collected.

A data text is keyed by the way English shows it: a name after title case (titles.title), a label part by part
(" · "), a note or a description as it is written. The names the game itself writes in other languages come from
the game's text (tools/game_names.py)."""
import ast
import json
import re
import sys
from pathlib import Path

CORE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CORE))
from audiodiver.i18n import DATA_DIR, LOCALE_DIR, entries  # noqa: E402

PLURAL_FORMS = {
    "en": "nplurals=2; plural=(n != 1);",
    "pt-BR": "nplurals=2; plural=(n > 1);",
    "pt-PT": "nplurals=2; plural=(n != 1);",
    "fr": "nplurals=2; plural=(n > 1);",
    "es-ES": "nplurals=2; plural=(n != 1);", "es-419": "nplurals=2; plural=(n != 1);",
    "de": "nplurals=2; plural=(n != 1);", "it": "nplurals=2; plural=(n != 1);",
    "pl": "nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);",
    "ru": "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);",
    "ja": "nplurals=1; plural=0;", "ko": "nplurals=1; plural=0;",
    "zh-Hans": "nplurals=1; plural=0;", "zh-Hant": "nplurals=1; plural=0;",
}


def collect() -> dict:
    """{msgid or (msgid, msgid_plural): [file names]} in the order first found."""
    found: dict = {}
    for path in sorted((CORE / "audiodiver").glob("*.py")):
        if path.name == "i18n.py":
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"), str(path))):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                continue
            args = node.args
            strs = [a.value for a in args if isinstance(a, ast.Constant) and isinstance(a.value, str)]
            if node.func.id in ("tr", "N_") and len(args) == 1 and len(strs) == 1:
                key = strs[0]
            elif node.func.id == "ntr" and len(args) == 3 and len(strs) >= 2 and all(
                    isinstance(a, ast.Constant) for a in args[:2]):
                key = (args[0].value, args[1].value)
            else:
                if node.func.id in ("tr", "N_", "ntr"):
                    print(f"  not collected (not a plain string): {path.name}:{node.lineno}")
                continue
            found.setdefault(key, [])
            if path.name not in found[key]:
                found[key].append(path.name)
    return found


def quote(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t") + '"'


def write(path: Path, lang: str, found: dict, old: dict):
    out = ['msgid ""', 'msgstr ""', quote("Content-Type: text/plain; charset=utf-8\n"),
           quote(f"Language: {lang}\n"), quote(f"Plural-Forms: {PLURAL_FORMS.get(lang, PLURAL_FORMS['en'])}\n"), ""]
    nforms = int(PLURAL_FORMS.get(lang, PLURAL_FORMS["en"]).split("nplurals=")[1].split(";")[0])
    for key, files in found.items():
        out.append(f"#: {' '.join(files)}")
        if isinstance(key, tuple):
            forms = old.get(key) or [""] * nforms
            out += [f"msgid {quote(key[0])}", f"msgid_plural {quote(key[1])}"]
            out += [f"msgstr[{i}] {quote(forms[i] if i < len(forms) else '')}" for i in range(nforms)]
        else:
            out += [f"msgid {quote(key)}", f"msgstr {quote(old.get(key, ''))}"]
        out.append("")
    path.write_text("\n".join(out), encoding="utf-8", newline="\n")


def read(path: Path) -> dict:
    old = {}
    for e in entries(path.read_text(encoding="utf-8")) if path.exists() else []:
        if e["msgid"] == "":
            continue
        if "msgid_plural" in e:
            old[(e["msgid"], e["msgid_plural"])] = [e[k] for k in sorted(k for k in e if k.startswith("msgstr["))]
        else:
            old[e["msgid"]] = e.get("msgstr", "")
    return old


def collect_data() -> dict:
    """{text: [where]} of every text the data files give the app, keyed as the core looks it up (i18n.dtr): a name
    after title case, a label part by part, a description or a note as it is written."""
    from audiodiver.catalog import LOCK_WORDS
    from audiodiver.titles import title
    data = CORE / "audiodiver" / "data"
    load = lambda name: json.loads((data / name).read_text(encoding="utf-8"))
    out: dict = {}

    def add(text, where, name=False):
        if isinstance(text, str) and text.strip():
            key = title(text) if name else text
            if where not in out.setdefault(key, []):
                out[key].append(where)

    def add_label(label, where):  # shown part by part (catalog.label_shown)
        for part in label.split(" · "):
            add(part, where)

    sounds = load("sounds.json")
    for cat in sounds["categories"]:
        add(cat["name"], "sounds.json: category", True)
        add(cat.get("about"), f"sounds.json: description of the category {cat['name']}")
        for sec in cat["sections"]:
            add(sec["name"], f"sounds.json: section of {cat['name']}", True)
            add(sec.get("about"), f"sounds.json: description of the section {sec['name']}")
            for e in sec["entries"]:
                add(e["name"], f"sounds.json: sound set in {cat['name']} ▸ {sec['name']}", True)
                add(e.get("about"), f"sounds.json: description of {e['name']}")

    music = load("music.json")
    for s in music["sections"]:
        if "name" in s:  # the combat section is one section per faction (below)
            add(s["name"], "music.json: section", True)
            add(s.get("about"), f"music.json: description of the section {s['name']}")
    for f in music["factions"]:
        add(f["name"], "music.json: enemy faction (a section)", True)
        add(f["short"], "music.json: enemy faction before a role ('Terminid' in 'Terminid Battle')", True)
        add(f["about"], f"music.json: description of the faction {f['name']}")
        for role, about in f.get("roles", {}).items():
            add(about, f"music.json: description of {role} music in {f['name']}")
    for r in music["roles"].values():
        add(r["name"], "music.json: role of combat music", True)
        add(r["about"], f"music.json: description of the role {r['name']}")
    for it in music["items"]:
        add(it["name"], "music.json: piece of music", True)
        add(it.get("about"), f"music.json: description of {it['name']}")
        for p in it.get("parts", []):
            add(p.get("name"), f"music.json: part of {it['name']}", True)
    for v in music["intensity"].values():
        add(v, "music.json: intensity of exploring music (a part's name, 'Low and Idle')", True)
    for v in music["biomes"].values():
        add(v, "music.json: biome (a part's name, 'Forest, Grassland and Arctic')", True)
    for v in music["places"].values():
        add(v, "music.json: where a transition leads ('Battle → Leaving the Mission')", True)
    for g in music["generated"].values():
        add(g["name"], "music.json: piece of music without a name, numbered ('Training Piece 3')", True)

    cat = load("catalog.json")
    for v in [*cat["factions"].values(), *cat["events"].values()]:
        add(v, "catalog.json: enemy faction (a group of cues)", True)
    for v in cat["values"].values():
        add(v, "catalog.json: a game state that tells cues apart ('forest / grassland · arrival')")
    for v in cat.get("groups", {}).values():
        add(v, "catalog.json: kind of condition, before its value ('biome: forest')")
    for c in cat["cues"].values():
        for x in c.get("path", []):
            add(x, "catalog.json: group of cues", True)
        add(c.get("name"), "catalog.json: piece of music (a cue)", True)
        add(c.get("notes"), f"catalog.json: note on {c.get('name', 'a cue')}")
        add(c.get("slot"), f"catalog.json: name of each segment of {c.get('name', 'a cue')} "
                           "({n} counts from 1, {n0} from 0: keep them)", True)
        add(c.get("slot_first"), f"catalog.json: name of the first segment of {c.get('name', 'a cue')}", True)

    for name in ("notes.json", "exertions.json"):
        for g in load(name)["groups"]:
            if "label" in g:
                add_label(g["label"], f"{name}: label of a clip")
            add(g.get("note"), f"{name}: note on {g.get('label') or 'a clip'}")
            add(g.get("tag"), f"{name}: tag on {g.get('label') or 'a clip'}")

    for labels in load("labels.json").values():
        for x in labels:
            label = re.sub(r"\s*\(\?\)", "", x).strip()
            if not label or LOCK_WORDS.search(label):
                continue
            add_label(label, "labels.json: name of a slot")
            base = re.sub(r"\s*(?:#\s*\d+|Cue \d+|\(\?\))\s*$", "", label).strip()  # catalog._label_name
            add(base, "labels.json: another name of a piece ('Also called …')")
            add(base, "labels.json: name of a piece of music nothing else names", True)

    for kind in dict.fromkeys(load("subtitles.json")["sounds"].values()):
        add(kind, "subtitles.json: what a clip without words is ('Grunt', numbered 'Grunt 3')")
    return out


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "stats"
    LOCALE_DIR.mkdir(exist_ok=True)
    if cmd == "extract":
        found = collect()
        langs = sorted({p.stem for p in LOCALE_DIR.glob("*.po")} | set(argv[2:]))
        for lang in langs:
            path = LOCALE_DIR / f"{lang}.po"
            old = read(path)
            write(path, lang, found, old)
            missing = sum(1 for k in found if not (old.get(k) and all(old[k]) if isinstance(k, tuple) else old.get(k)))
            print(f"{lang}: {len(found)} messages, {missing} without a translation")
        if not langs:
            print(f"{len(found)} messages; name a language to start a catalog")
    elif cmd == "stats":
        for path in sorted(LOCALE_DIR.glob("*.po")):
            es = [e for e in entries(path.read_text(encoding="utf-8")) if e["msgid"]]
            empty = sum(1 for e in es if not (e.get("msgstr") or e.get("msgstr[0]")))
            print(f"{path.stem}: {len(es)} messages, {empty} without a translation")
    elif cmd == "missing":
        # the messages without a translation, as JSON: {msgid: ""} or, for a count, {msgid: {"plural": msgid_plural}}
        old, found = read(LOCALE_DIR / f"{argv[2]}.po"), collect()
        out = {}
        for key in found:
            if isinstance(key, tuple):
                if not (old.get(key) and all(old[key])):
                    out[key[0]] = {"plural": key[1]}
            elif not old.get(key):
                out[key] = ""
        text = json.dumps(out, ensure_ascii=False, indent=1)
        if len(argv) > 3:
            Path(argv[3]).write_text(text, encoding="utf-8")
            print(f"{len(out)} messages without a translation -> {argv[3]}")
        else:
            print(text)
    elif cmd == "fill":
        # {msgid: translation}, or for a count {msgid: [form, form, ...]} in the language's plural order
        lang, given = argv[2], json.loads(Path(argv[3]).read_text(encoding="utf-8"))
        path, found = LOCALE_DIR / f"{lang}.po", collect()
        old = read(path)
        plurals = {k[0]: k for k in found if isinstance(k, tuple)}
        filled = 0
        for msgid, value in given.items():
            key = plurals.get(msgid, msgid)
            if key in found and value and isinstance(value, list) == isinstance(key, tuple):
                old[key], filled = value, filled + 1
        write(path, lang, found, old)
        print(f"{lang}: {filled} filled; {len(given) - filled} not used")
    elif cmd == "data":
        found = collect_data()
        DATA_DIR.mkdir(exist_ok=True)
        (DATA_DIR / "en.json").write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                                          newline="\n")
        print(f"{len(found)} data texts -> {DATA_DIR / 'en.json'}")
        for path in sorted(DATA_DIR.glob("*.json")):
            if path.stem != "en":
                have = json.loads(path.read_text(encoding="utf-8"))
                print(f"{path.stem}: {sum(1 for k in found if have.get(k))} translated, "
                      f"{sum(1 for k in have if k not in found)} no longer in the data")
    elif cmd == "data-missing":
        found = json.loads((DATA_DIR / "en.json").read_text(encoding="utf-8"))
        path = DATA_DIR / f"{argv[2]}.json"
        have = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        out = {k: where for k, where in found.items() if not have.get(k)}
        text = json.dumps(out, ensure_ascii=False, indent=1)
        if len(argv) > 3:
            Path(argv[3]).write_text(text, encoding="utf-8")
            print(f"{len(out)} data texts without a translation -> {argv[3]}")
        else:
            print(text)
    elif cmd == "data-fill":
        # {text: translation}: added to the language's file, keys sorted; a text en.json doesn't have is left out
        found = json.loads((DATA_DIR / "en.json").read_text(encoding="utf-8"))
        path = DATA_DIR / f"{argv[2]}.json"
        have = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        given = json.loads(Path(argv[3]).read_text(encoding="utf-8"))
        used = {k: v for k, v in given.items() if k in found and isinstance(v, str) and v.strip()}
        have.update(used)
        path.write_text(json.dumps(dict(sorted(have.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                        newline="\n")
        print(f"{argv[2]}: {len(used)} filled; {len(given) - len(used)} not used")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
