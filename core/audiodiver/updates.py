"""Audiodiver's own releases, read from its GitHub repository: what the Updates tab lists (each version's date,
changelog and installer) and what the startup check compares the running app with.

This module only reads. The desktop shell installs an update (its updater plugin downloads the installer named in
the release's latest.json and checks its signature before running it). AUDIODIVER_RELEASES names a JSON file in
the GitHub API's format to read instead of GitHub (development and tests).
"""
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request

REPO = "Alomare/Audiodiver"  # also in the app (content.ts) and in the shell's updater endpoint (tauri.conf.json)
URL = f"https://github.com/{REPO}"
API = f"https://api.github.com/repos/{REPO}/releases?per_page=30"
FRESH = 600  # seconds a listing is reused: GitHub allows 60 calls an hour without an account

log = logging.getLogger("audiodiver")
_lock = threading.Lock()
_last: dict = {"at": 0.0, "answer": None}


def _installer(assets):
    """The Windows installer among a release's files, if it has one."""
    for a in assets or []:
        name = a.get("name") or ""
        if name.lower().endswith("-setup.exe"):
            return {"name": name, "size": a.get("size") or 0, "url": a.get("browser_download_url") or ""}
    return None


def parse(listing) -> list[dict]:
    """The published releases in the API's answer, in its order (newest first). A tag "v1.2.0" is version "1.2.0"."""
    out = []
    for r in listing if isinstance(listing, list) else []:
        if not isinstance(r, dict):
            continue
        tag = (r.get("tag_name") or "").strip()
        version = tag[1:] if tag[:1] in ("v", "V") else tag
        if r.get("draft") or not version:
            continue
        out.append({
            "version": version,
            "name": r.get("name") or tag,
            "date": (r.get("published_at") or "")[:10],
            "notes": r.get("body") or "",
            "url": r.get("html_url") or f"{URL}/releases/tag/{tag}",
            "prerelease": bool(r.get("prerelease")),
            "installer": _installer(r.get("assets")),
        })
    return out


def _fetch():
    test = os.environ.get("AUDIODIVER_RELEASES")
    if test:
        with open(test, encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(API, headers={"Accept": "application/vnd.github+json", "User-Agent": "Audiodiver",
                                               "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def releases(force=False) -> dict:
    """{"repo", "releases", "checked" (unix time), "error"}: error is None, "offline" (GitHub can't be reached),
    "limit" (too many checks this hour) or what went wrong. A repository that isn't public answers 404: no releases.
    An answer is reused for FRESH seconds unless forced; a failed check isn't kept."""
    with _lock:
        if not force and _last["answer"] and time.time() - _last["at"] < FRESH:
            return _last["answer"]
        error, found = None, []
        try:
            found = parse(_fetch())
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                error = "limit"
            elif e.code != 404:
                error = f"GitHub answered {e.code}"
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            error = "offline"
        except (ValueError, OSError) as e:
            error = str(e)
        answer = {"repo": URL, "releases": found, "checked": time.time(), "error": error}
        if error:
            log.info("releases: %s", error)
        else:
            _last.update(at=answer["checked"], answer=answer)
        return answer
