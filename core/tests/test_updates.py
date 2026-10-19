"""The Updates tab's release list (updates.py). Nothing here reaches GitHub."""
import json
import urllib.error

import pytest

from audiodiver import updates

LISTING = [
    {"tag_name": "v1.0.0-beta.3", "name": "Beta 3", "draft": True, "published_at": None, "body": "", "assets": []},
    {"tag_name": "v1.0.0-beta.2", "name": "Beta 2", "draft": False, "prerelease": False,
     "published_at": "2026-11-02T18:00:00Z", "body": "### Fixed\n- A thing", "html_url": "https://example/b2",
     "assets": [{"name": "latest.json", "size": 900, "browser_download_url": "https://example/latest.json"},
                {"name": "Audiodiver_1.0.0-beta.2_x64-setup.exe", "size": 25_000_000,
                 "browser_download_url": "https://example/setup.exe"}]},
    {"tag_name": "1.0.0-beta.1", "name": "", "draft": False, "published_at": "2026-10-18T10:00:00Z", "body": None, "assets": []},
]


@pytest.fixture(autouse=True)
def fresh():
    updates._last.update(at=0.0, answer=None)
    yield
    updates._last.update(at=0.0, answer=None)


def test_parse_lists_published_releases_with_their_installer():
    found = updates.parse(LISTING)
    assert [r["version"] for r in found] == ["1.0.0-beta.2", "1.0.0-beta.1"]  # the draft is left out, "v" taken off
    b2, b1 = found
    assert b2["date"] == "2026-11-02" and b2["notes"].startswith("### Fixed") and b2["url"] == "https://example/b2"
    assert b2["installer"] == {"name": "Audiodiver_1.0.0-beta.2_x64-setup.exe", "size": 25_000_000, "url": "https://example/setup.exe"}
    assert b1["name"] == "1.0.0-beta.1" and b1["notes"] == "" and b1["installer"] is None
    assert b1["url"].endswith("/releases/tag/1.0.0-beta.1")
    assert updates.parse({"message": "Not Found"}) == []


def test_a_file_can_stand_in_for_github(tmp_path, monkeypatch):
    f = tmp_path / "releases.json"
    f.write_text(json.dumps(LISTING), encoding="utf-8")
    monkeypatch.setenv("AUDIODIVER_RELEASES", str(f))
    answer = updates.releases()
    assert answer["error"] is None and answer["repo"] == "https://github.com/Alomare/Audiodiver"
    assert [r["version"] for r in answer["releases"]] == ["1.0.0-beta.2", "1.0.0-beta.1"]


@pytest.mark.parametrize("fail, error", [
    (urllib.error.HTTPError("u", 404, "Not Found", {}, None), None),  # not public yet: nothing to list, nothing wrong
    (urllib.error.HTTPError("u", 403, "rate limit", {}, None), "limit"),
    (urllib.error.HTTPError("u", 502, "Bad Gateway", {}, None), "GitHub answered 502"),
    (urllib.error.URLError("getaddrinfo failed"), "offline"),
    (TimeoutError("timed out"), "offline"),
])
def test_what_a_failed_check_says(monkeypatch, fail, error):
    def boom():
        raise fail
    monkeypatch.setattr(updates, "_fetch", boom)
    answer = updates.releases()
    assert answer["releases"] == [] and answer["error"] == error


def test_answers_are_reused_unless_forced_and_failures_are_not_kept(monkeypatch):
    calls = []
    def fetch():
        calls.append(1)
        if len(calls) == 1:
            raise urllib.error.URLError("down")
        return LISTING
    monkeypatch.setattr(updates, "_fetch", fetch)
    assert updates.releases()["error"] == "offline"
    assert len(updates.releases()["releases"]) == 2  # the failure wasn't kept: asked again
    updates.releases()
    assert len(calls) == 2                           # fresh enough: reused
    updates.releases(force=True)
    assert len(calls) == 3
