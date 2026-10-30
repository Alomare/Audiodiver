"""The Index names the game itself writes, in other languages: into audiodiver/locale/data/<language>.json.

  python tools/game_names.py [language ...]   (default: the languages the release ships, SHIPPED)
  python tools/game_names.py --check          says what it would write, and writes nothing

The installed game's text (strings.Texts) has the names of the weapons, stratagems and enemies in every language it
speaks. A sound set's name in the Index (data/sounds.json, title case as the Index shows it) that is a whole line of
the game's US English text, as it is written ("Liberator Legacy") or after the designation ("AR-23 Liberator" →
"Liberator"), has its name in each language under the same string IDs. Where those IDs disagree, the text most of
them give wins (compared without case). The game writes many names twice, once in capitals for headings: the one in
lower case is taken, and a name the game has only in capitals is left out (a translator writes it). Straight double
quotes become typographic ones, as the app writes them; quotation marks the language itself uses («», “”, 「」) stay.
The designation goes back the way the language writes the names the game has whole with one ("LAS-13 Tridente",
"LAS-13“三叉戟”"; template).

Each name written replaces what the file had for it; the file's other texts (translated from data/en.json, see
tools/i18n.py) stay. Needs the installed game."""
import collections
import json
import re
import sys
from pathlib import Path

CORE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CORE))
from audiodiver import strings  # noqa: E402
from audiodiver.game import Game  # noqa: E402
from audiodiver.i18n import DATA_DIR  # noqa: E402
from audiodiver.titles import title  # noqa: E402

# the game's language codes (strings.LANGUAGES) for the app's languages
GAME_CODES = {"fr": "fr", "de": "de", "it": "it", "es-ES": "es", "es-419": "ms", "pt-PT": "pt", "pt-BR": "bp",
              "pl": "pl", "ru": "ru", "ja": "jp", "ko": "ko", "zh-Hans": "cn", "zh-Hant": "tc"}
SHIPPED = ["pt-BR", "zh-Hans", "fr", "es-ES", "ja"]  # the languages the next release ships besides English (app i18n.ts LANGUAGES)
DESIGNATION = re.compile(r"^[A-Z0-9/]+-[\w/]+\s+")  # "AR-23 ", "AR/GL-21 ", "R/40-K "
# Index names whose line in the game's text means something else: "Fire" (the hazard) is the order to fire there
NOT_THE_GAMES = {"Fire"}
QUOTES = "\"«»“”„‘’「」『』"
CASED = re.compile(r"[^\W\d_]")


def names() -> list[str]:
    """The sound sets' names as the Index shows them (the keys of the data catalog)."""
    d = json.loads((CORE / "audiodiver" / "data" / "sounds.json").read_text(encoding="utf-8"))
    return list(dict.fromkeys(title(e["name"]) for c in d["categories"] for s in c["sections"] for e in s["entries"]))


def capitals_only(text: str) -> bool:
    """In capitals, as a heading writes it. A word with a digit (a designation, "C4") doesn't count."""
    letters = [c for c in re.sub(r"\S*\d\S*", "", text) if CASED.match(c) and c.lower() != c.upper()]
    return bool(letters) and all(c.isupper() for c in letters)


def typographic(text: str) -> str:
    """Straight double quotes as “ ”, in pairs."""
    parts = text.split('"')
    if len(parts) % 2 == 0:  # an odd number of quotes: left as it is
        return text
    return "".join(p if i % 2 == 0 else f"“{p}”" for i, p in enumerate(parts))


def pick(texts: list[str]) -> str | None:
    """The text most IDs give (without case or quotation marks), in lower case where the game has it so; None when
    the game has it only in capitals."""
    groups = collections.defaultdict(list)
    for t in texts:
        groups[re.sub(f"[{QUOTES}]", "", t).casefold().strip()].append(t)
    if not groups:
        return None
    best = max(groups.values(), key=lambda g: (len(g), any(not capitals_only(t) for t in g)))
    lower = [t for t in best if not capitals_only(t)]
    return collections.Counter(lower).most_common(1)[0][0] if lower else None


def template(whole: list[tuple[str, str]]) -> str:
    """How a language writes a name with its designation, from the names the game writes whole with one ((the
    designation, the language's text): "LAS-13 Tridente", "Trident LAS-13", "LAS-13“三叉戟”"): "{d} {n}", "{n} {d}"
    or "{d}“{n}”" (the name in the language's quotation marks), whichever most of them have; "{d} {n}" without any.
    Sentences that name a weapon or a stratagem in passing are no guide: the game's announcements put the designation
    of a stratagem after its name where the armory puts it before."""
    found = collections.Counter()
    for d, text in whole:
        if text.startswith(d) and len(text) > len(d):
            rest = text[len(d):]
            found["{d} {n}" if rest[0] == " " else f"{{d}}{rest[0]}{{n}}{rest[-1]}" if rest[0] in QUOTES
                  and rest[-1] in QUOTES else "{d}{n}"] += 1
        elif text.endswith(d) and len(text) > len(d):
            found["{n} {d}" if text[-len(d) - 1] == " " else "{n}{d}"] += 1
    return found.most_common(1)[0][0] if found else "{d} {n}"


def with_designation(form: str, d: str, n: str) -> str:
    """The name n with its designation d, as `form` writes it; a name that holds quotation marks already isn't
    put inside more."""
    if any(q in n for q in QUOTES) and form.startswith("{d}") and form[3:4] in QUOTES:
        return f"{d}{n}"
    return form.format(d=d, n=n)


def main(argv):
    check = "--check" in argv
    langs = [a for a in argv[1:] if not a.startswith("--")] or SHIPPED
    tx = strings.Texts(Game())
    en = collections.defaultdict(set)  # a line of US English, without case -> its string IDs
    for _, t in tx.tables("us"):
        for i, s in t.texts.items():
            if p := strings.plain(s).strip().lower():
                en[p].add(i)
    matched = {}  # Index name -> (designation, the string IDs of the name)
    for name in names():
        if name in NOT_THE_GAMES:
            continue
        if name.lower() in en:
            matched[name] = ("", sorted(en[name.lower()]))
        elif (m := DESIGNATION.match(name)) and name[m.end():].lower() in en:
            matched[name] = (m.group(0).strip(), sorted(en[name[m.end():].lower()]))
    print(f"{len(matched)} of {len(names())} Index names are a line of the game's US English text")
    for lang in langs:
        code = GAME_CODES[lang]
        texts = {}
        for _, t in tx.tables(code):
            texts.update(t.texts)
        found, skipped = {}, []  # Index name -> the language's text (without the designation that goes back)
        for name, (d, ids) in matched.items():
            got = pick([p for i in ids if (p := strings.plain(texts.get(i, "")).strip())])
            if got is None:
                skipped.append(name)
            else:
                found[name] = typographic(got)
        whole = [(m.group(0).strip(), found[n]) for n, (d, _) in matched.items()
                 if not d and n in found and (m := DESIGNATION.match(n)) and m.group(0).strip() in found[n]]
        form = template(whole)
        out = {name: with_designation(form, matched[name][0], n) if matched[name][0] else n
               for name, n in found.items()}
        path = DATA_DIR / f"{lang}.json"
        print(f"{lang} ({code}): {len(out)} names, designation as {form!r}; "
              f"{len(skipped)} only in capitals, left out: {skipped[:8]}")
        if check:
            for name in list(out)[:12]:
                print(f"   {name} -> {out[name]}")
            continue
        have = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        have.update(out)
        path.write_text(json.dumps(dict(sorted(have.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                        newline="\n")
        print(f"   written to {path}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv)
