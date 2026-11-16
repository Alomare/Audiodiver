"""What differs on Linux (host.py): the trash, the Documents folder, Steam's folders, the language, and the
environment a program of the system gets from inside an AppImage. Linux only."""
import os
from pathlib import Path

import pytest

from audiodiver import host

pytestmark = pytest.mark.skipif(os.name == "nt", reason="Linux only")


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    for var in ("XDG_DATA_HOME", "XDG_CONFIG_HOME"):
        monkeypatch.delenv(var, raising=False)
    return tmp_path


def test_files_go_to_the_trash_with_where_they_were(home):
    a = home / "proj" / "a.wav"
    a.parent.mkdir()
    a.write_bytes(b"one")
    b = home / "other" / "a.wav"
    b.parent.mkdir()
    b.write_bytes(b"two")
    host.trash([a, b])
    trash = home / ".local" / "share" / "Trash"
    assert not a.exists() and not b.exists()
    assert sorted(p.name for p in (trash / "files").iterdir()) == ["a 2.wav", "a.wav"]
    info = (trash / "info" / "a.wav.trashinfo").read_text()
    assert info.startswith("[Trash Info]\nPath=") and str(a).replace(" ", "%20") in info and "DeletionDate=" in info
    assert (trash / "files" / "a 2.wav").read_bytes() == b"two"


def test_the_documents_folder_follows_user_dirs(home):
    assert host.documents() == home / "Documents"
    (home / ".config").mkdir()
    (home / ".config" / "user-dirs.dirs").write_text('XDG_DOCUMENTS_DIR="$HOME/Dokumente"\n')
    assert host.documents() == home / "Dokumente"
    (home / ".config" / "user-dirs.dirs").write_text('XDG_DOCUMENTS_DIR="$HOME/"\n')  # turned off: $HOME
    assert host.documents() == home / "Documents"


def test_steam_is_found_native_flatpak_or_snap(home):
    assert host.steam_roots_linux() == []
    flatpak = home / ".var" / "app" / "com.valvesoftware.Steam" / ".local" / "share" / "Steam"
    (flatpak / "steamapps").mkdir(parents=True)
    native = home / ".local" / "share" / "Steam"
    (native / "steamapps").mkdir(parents=True)
    (home / ".steam").mkdir()
    (home / ".steam" / "steam").symlink_to(native)  # the link Steam makes: one root, not two
    assert host.steam_roots_linux() == [str(native), str(flatpak)]


def test_the_language_comes_from_the_locale(monkeypatch):
    for var in ("LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"):
        monkeypatch.delenv(var, raising=False)
    assert host.system_language() is None
    monkeypatch.setenv("LANG", "pt_BR.UTF-8")
    assert host.system_language() == "pt-BR"
    monkeypatch.setenv("LC_ALL", "C")
    assert host.system_language() == "pt-BR"  # C says nothing
    monkeypatch.setenv("LANGUAGE", "ko_KR:en")
    assert host.system_language() == "ko-KR"


def test_a_program_of_the_system_gets_the_environment_without_the_appimage(monkeypatch):
    monkeypatch.setenv("APPDIR", "/tmp/.mount_Audio1")
    monkeypatch.setenv("APPIMAGE", "/home/u/Audiodiver.AppImage")
    monkeypatch.setenv("LD_LIBRARY_PATH", "/tmp/.mount_Audio1/usr/lib:/opt/lib")
    monkeypatch.setenv("PATH", "/tmp/.mount_Audio1/usr/bin:/usr/bin")
    monkeypatch.setenv("GST_PLUGIN_SYSTEM_PATH", "/tmp/.mount_Audio1/usr/lib/gstreamer-1.0")
    env = host.system_env()
    assert "APPDIR" not in env and "APPIMAGE" not in env and "GST_PLUGIN_SYSTEM_PATH" not in env
    assert env["LD_LIBRARY_PATH"] == "/opt/lib" and env["PATH"] == "/usr/bin"
    monkeypatch.delenv("APPDIR")
    assert host.system_env()["PATH"] == "/tmp/.mount_Audio1/usr/bin:/usr/bin"  # outside an AppImage: as it is


def test_the_core_keeps_its_files_in_the_xdg_data_folder(home, monkeypatch):
    assert host.data_home() == home / ".local" / "share"
    monkeypatch.setenv("XDG_DATA_HOME", str(home / "data"))
    assert host.data_home() == home / "data" and host.config_home() == home / ".config"
    assert Path(host.data_home()).name == "data"
