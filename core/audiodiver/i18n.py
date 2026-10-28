"""The language of what the core says: errors, job steps, names it makes up. Messages are written in English in the
code and go through `tr()`, or `ntr()` for a count; `N_()` marks one kept in a constant, translated where it is used.
(Not `_()`, the gettext custom: the core uses `_` for values it throws away, which would hide it inside a function.)
The catalogs are `locale/<language>.po` beside this file (`tools/i18n.py extract` adds new messages to them), read
when a language is chosen. A message without a translation stays in English.

The app sets the language to the window's (`set_language`, through the API); the core keeps it in its settings and
starts in it next time, so the first messages of a start come out in it too.

The texts the data files give the app (names in the Index and the Music view, clip notes, labels) go through `dtr()`:
`locale/data/<language>.json` holds {English: translation}, keyed by the text as the core shows it in English (after
title case, where the core applies it). `locale/data/en.json` lists every such text with where it comes from
(`tools/i18n.py data`), for translators; the names the game itself writes come from the game's text
(`tools/game_names.py`). A text without a translation stays in English."""
import ast
import gettext
import json
import re
import threading
from pathlib import Path

LOCALE_DIR = Path(__file__).parent / "locale"
DATA_DIR = LOCALE_DIR / "data"
_lock = threading.Lock()
_FIELD = re.compile(r'(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")$')


def entries(text: str) -> list[dict]:
    """The entries of a .po file, each {"msgid": ..., "msgstr": ...} (with "msgid_plural" and "msgstr[n]" for a
    plural, "msgctxt" for a context). Comments are skipped."""
    out, cur, field = [], {}, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            if "msgid" in cur and field and field.startswith("msgstr"):
                out.append(cur)
                cur, field = {}, None
            continue
        m = _FIELD.match(line)
        if m:
            key = m.group(1)
            if key in ("msgctxt", "msgid") and field and field.startswith("msgstr"):
                out.append(cur)
                cur = {}
            field = key
            cur[key] = ast.literal_eval(m.group(2))  # PO escapes are the same as Python's for what catalogs hold
        elif line.startswith('"') and field:
            cur[field] += ast.literal_eval(line)
    if "msgid" in cur:
        out.append(cur)
    return out


class Catalog(gettext.NullTranslations):
    """A .po file as gettext translations: msgid to msgstr, plurals by the file's Plural-Forms."""

    def __init__(self, path: Path):
        super().__init__()
        self.messages: dict = {}
        self.plural = lambda n: int(n != 1)
        for e in entries(path.read_text(encoding="utf-8")):
            msgid = e["msgid"]
            if msgid == "":
                forms = re.search(r"Plural-Forms:\s*nplurals=\d+;\s*plural=([^;\n]+)", e.get("msgstr", ""))
                if forms:
                    self.plural = gettext.c2py(forms.group(1).strip())
            elif "msgid_plural" in e:
                forms = [e[k] for k in sorted(k for k in e if k.startswith("msgstr["))]
                if forms and all(forms):
                    self.messages[(msgid, e["msgid_plural"])] = forms
            elif e.get("msgstr"):
                self.messages[msgid] = e["msgstr"]

    def gettext(self, message):
        return self.messages.get(message, message)

    def ngettext(self, msgid1, msgid2, n):
        forms = self.messages.get((msgid1, msgid2))
        if forms:
            return forms[min(self.plural(n), len(forms) - 1)]
        return msgid1 if n == 1 else msgid2


_current: gettext.NullTranslations = gettext.NullTranslations()
_language = "en"
_data: dict[str, str] = {}  # the data texts in the language in use: {English: translation}


def available() -> list[str]:
    """The languages with a catalog of messages or of data texts, as tags ("pt-BR")."""
    return sorted({p.stem for p in LOCALE_DIR.glob("*.po")} | {p.stem for p in DATA_DIR.glob("*.json")} - {"en"})


def resolve(tag: str | None) -> str:
    """The language `set_language(tag)` would speak, without loading it: "pt" or "pt-PT" find "pt-BR" when there is
    no catalog for them, and a language without any catalog is English."""
    tag = (tag or "en").replace("_", "-")
    have = available()
    return next((h for h in have if h.lower() == tag.lower()), None) \
        or next((h for h in have if h.split("-")[0].lower() == tag.split("-")[0].lower()), None) or "en"


def data_catalog(lang: str) -> dict[str, str]:
    """{English: translation} of the data texts in a language ({} for English, or a file that can't be read)."""
    if lang == "en":
        return {}
    try:
        d = json.loads((DATA_DIR / f"{lang}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {k: v for k, v in d.items() if isinstance(k, str) and isinstance(v, str) and v} if isinstance(d, dict) else {}


def set_language(tag: str | None) -> str:
    """Speaks `tag` ("pt-BR"; "pt" or "pt-PT" find "pt-BR" too) from now on, else English. Returns the language in
    use."""
    global _current, _language, _data
    pick = resolve(tag)
    po = LOCALE_DIR / f"{pick}.po"
    catalog = Catalog(po) if pick != "en" and po.exists() else gettext.NullTranslations()
    data = data_catalog(pick)
    with _lock:
        _current, _language, _data = catalog, pick, data
    return _language


def language() -> str:
    return _language


def system_language() -> str | None:
    """The language Windows shows ("pt-BR"), or None elsewhere."""
    try:
        import ctypes
        import locale
        name = locale.windows_locale.get(ctypes.windll.kernel32.GetUserDefaultUILanguage())
        return name.replace("_", "-") if name else None
    except (AttributeError, OSError):
        return None


def tr(message: str) -> str:
    return _current.gettext(message)


def ntr(one: str, other: str, n: int) -> str:
    return _current.ngettext(one, other, n)


def N_(message: str) -> str:
    """Marks a message for the catalogs where it can't be translated yet (a constant at module level, a state kept
    for later): `tr()` it where it is shown."""
    return message


def dtr(text: str) -> str:
    """A text from the core's data files (a name, a note, a label) in the language in use, else as it is. A name
    goes through `titles.title()` first, as the key is the text the way English shows it."""
    return _data.get(text, text) if text else text
