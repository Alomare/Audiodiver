"""Every test reads and writes a copy of the core's settings, so what a test chooses (a Repatch folder in its temp
folder) never becomes the person's setting. Global notes go to a file of the tests, empty to start with."""
import shutil

import pytest

from audiodiver import editor, notes


@pytest.fixture(autouse=True, scope="session")
def _own_settings(tmp_path_factory):
    copy = tmp_path_factory.mktemp("settings") / "settings.json"
    if editor.SETTINGS_FILE.exists():
        shutil.copyfile(editor.SETTINGS_FILE, copy)  # where the game is, as the person's core found it
    with pytest.MonkeyPatch.context() as m:
        m.setattr(editor, "SETTINGS_FILE", copy)
        m.setattr(notes, "FILE", copy.parent / "notes.json")
        yield
