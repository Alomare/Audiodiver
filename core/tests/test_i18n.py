"""Translations keep what the code fills in: the values, tags and fields of the English message, so a translated
message shows the same things and never breaks the code around it (a field the core doesn't pass would raise)."""
import re
import string
from pathlib import Path

from audiodiver import i18n
from audiodiver.i18n import LOCALE_DIR, entries

APP_LOCALES = Path(__file__).parents[2] / "app" / "src" / "locales"


BRANCH = re.compile(r"[,}]\s*(?:zero|one|two|few|many|other|=\d+)\s*$")  # a branch: after "plural," or a branch


def icu_values(message):
    """The values an ICU message (the app's) names: {name}, {count, plural, ...}; a plural branch of one word
    ("one {minute}") is text."""
    return {m.group(1) for m in re.finditer(r"\{\s*([A-Za-z_]\w*)\s*[,}]", message)
            if not BRANCH.search(message[:m.start()])}


def icu_tags(message):
    """The tags of a <Trans> message: <0>, </0>, <1/>, as a sorted list."""
    return sorted(re.findall(r"<(/?\d+/?)>", message))


def format_fields(message):
    """The fields str.format fills in a core message; raises ValueError on unbalanced braces."""
    return {name.split(".")[0].split("[")[0] for _, name, _, _ in string.Formatter().parse(message) if name}


def app_catalogs():
    return [p / "messages.po" for p in sorted(APP_LOCALES.iterdir()) if p.is_dir() and p.name not in ("en", "pseudo")]


def test_app_translations_keep_the_values_and_tags():
    found = []
    for path in app_catalogs():
        for e in entries(path.read_text(encoding="utf-8")):
            msgid, msgstr = e["msgid"], e.get("msgstr", "")
            if not msgid or not msgstr:
                continue
            if "plural," in msgid:
                # a language with fewer plural forms drops the branches it lacks, with their values and tags
                ok = icu_values(msgstr) <= icu_values(msgid) and set(icu_tags(msgstr)) <= set(icu_tags(msgid))
            else:
                ok = icu_values(msgid) == icu_values(msgstr) and icu_tags(msgid) == icu_tags(msgstr)
            if not ok:
                found.append(f"{path.parent.name}: {msgid[:60]!r} -> {msgstr[:60]!r}")
    assert found == []


def test_core_translations_format_with_the_fields_of_the_english():
    found = []
    for path in sorted(LOCALE_DIR.glob("*.po")):
        for e in entries(path.read_text(encoding="utf-8")):
            if not e["msgid"]:
                continue
            english = format_fields(e["msgid"]) | format_fields(e.get("msgid_plural", ""))
            forms = [e[k] for k in e if k.startswith("msgstr") and e[k]]
            for form in forms:
                try:
                    extra = format_fields(form) - english
                except ValueError as err:
                    found.append(f"{path.stem}: {e['msgid'][:60]!r}: {err}")
                    continue
                if extra:
                    found.append(f"{path.stem}: {e['msgid'][:60]!r} has fields the code doesn't pass: {sorted(extra)}")
            if "msgid_plural" not in e and forms and format_fields(forms[0]) != format_fields(e["msgid"]):
                found.append(f"{path.stem}: {e['msgid'][:60]!r} leaves out a field")
    assert found == []


def test_the_core_speaks_the_language_it_is_set_to():
    try:
        assert i18n.set_language("en") == "en" and i18n.tr("No project open") == "No project open"
        for lang in i18n.available():
            assert i18n.set_language(lang) == lang
        assert i18n.set_language("xx-YY") == "en"
    finally:
        i18n.set_language("en")
