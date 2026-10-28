"""Local HTTP API for the editor UI (127.0.0.1 only, token-protected).

    python -m audiodiver serve [--port 0] [--token T]

Prints one line, `AUDIODIVER_SERVER {"port": ..., "token": ...}`, once it listens; the Tauri shell reads it.

    POST /api/<method>        JSON body -> JSON result, or {"error": "..."} with status 400
    GET  /audio/vanilla/<id>  the game's audio of a source (WAV)
    GET  /audio/project/<id>  the audio assigned to a source in the open project
    GET  /audio/file?path=…   a local audio file of a type projects take (the slice tool's song, a play-through)
    GET  /project/icon        the open project's icon as the build packages it (PNG); ?icon=<JSON> previews an
                              icon that isn't saved yet (its frame, as the settings method takes it)
    GET  /projects/icon?path=…  the icon of a project file that isn't open (Home's recent project)
    GET  /mods/icon?path=…  the image a mod's manifest names as the mod's icon (Import Mod), as it is

GET URLs take the token as ?token=, since <audio> and <img> elements can't send headers.
"""
import hashlib
import json
import mimetypes
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import i18n, updates, wem
from .audio import cache_lock, natural
from .editor import (AUDIO_TYPES, EditorError, Session, cache_clear, cache_info, load_settings, log, mod_icon,
                     os_error, plain, project_icon, projects_info, reveal)
from .i18n import tr
from .index import CACHE_DIR

BROWSER_AUDIO = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg",
                 ".flac": "audio/flac", ".m4a": "audio/mp4", ".aac": "audio/aac"}


def methods(s: Session) -> dict:
    return {
        "status": lambda: s.status(),
        "set_language": lambda language: s.set_language(language),
        "cues": lambda: s.cues(),
        "music": lambda: s.music(),
        "index": lambda: s.index(),
        "archives": lambda: s.archives(),
        "item": lambda id: s.item(id),
        "library_add": lambda items: s.library_add(items),
        "library_remove": lambda items: s.library_remove(items),
        "library_remove_preview": lambda items: s.library_remove_preview(items),
        "skip": lambda sources: s.skip(sources),
        "silence": lambda sources, keep_timing=False: s.silence(sources, keep_timing),
        "set_game_folder": lambda path=None: s.set_game_folder(path),
        "cue": lambda id, mine=False, ids=False: s.cue(id, mine, ids),
        "add_takes": lambda container, files: s.add_takes(container, files),
        "add_layer": lambda beside, files: s.add_layer(beside, files),
        "own_clip": lambda source, sound: s.own_clip(source, sound),
        "shared_clip": lambda source: s.shared_clip(source),
        "find": lambda query: s.find(query),
        "find_text": lambda query: s.find_text(query),
        "project": lambda: s.project_state() if s.project else None,
        "project_new": lambda path, name="", folder=True, tabs=None: s.new_project(path, name, folder, tabs),
        "project_open": lambda path: s.open_project(path),
        "project_close": lambda: s.close_project(),
        "project_save": lambda: s.save_project(),
        "autosave": lambda minutes=0: s.set_autosave(minutes),
        "projects_info": lambda paths: projects_info(paths),
        "projects_folder": lambda: s.projects_folder(),
        "project_move": lambda: s.move_to_own_folder(),
        "project_move_to": lambda folder, check=False: s.move_project(folder, check),
        "unused_files": lambda: s.unused_files(),
        "unused_remove": lambda paths: s.remove_unused_files(paths),
        "collect_files": lambda: s.collect_files(),
        "pack_export": lambda dest: s.export_pack(dest),
        "pack_open": lambda path, folder=None: s.open_pack(path, folder),
        "set_icon": lambda image: s.set_icon(image),
        "cache_info": lambda: cache_info(),
        "cache_clear": lambda kind: cache_clear(kind),
        "assign": lambda source, audio, label=None: s.assign(source, audio, label),
        "fill": lambda cue, files, only_empty=False, start_source=None: s.fill(cue, files, only_empty, start_source),
        "fill_sources": lambda sources, files, only_empty=False: s.fill_sources(sources, files, only_empty),
        "copy_audio": lambda pairs: s.copy_audio(pairs),
        "swap": lambda a, b: s.swap(a, b),
        "unassign": lambda sources: s.unassign(sources),
        "update": lambda source, **f: s.update(source, **f),
        "update_many": lambda sources, **f: s.update_many(sources, **f),
        "original_gain": lambda sources, gain_db: s.original_gain(sources, gain_db),
        "match_loudness": lambda sources: s.match_loudness(sources),
        "settings": lambda **f: s.settings(**f),
        "note_set": lambda key, project_text: s.set_note(key, project_text),
        "notes_global": lambda: s.global_notes(),
        "note_global_set": lambda key, text: s.set_global_note(key, text),
        "notes_folder_set": lambda folder=None: s.set_notes_folder(folder),
        "notes_export": lambda path, what="global", form="md": s.export_notes(path, what, form),
        "notes_import": lambda path: s.import_notes(path),
        "segment_override": lambda segment, entry_marker=None, exit_marker=None:
            s.segment_override(segment, entry_marker, exit_marker),
        "segment_overrides": lambda segments, **cues: s.segment_overrides(segments, **cues),
        "same_cue_points": lambda segment, source: s.same_cue_points(segment, source),
        "peaks": lambda kind, source=None, path=None, buckets=1200, full=255: s.peaks(kind, source, path, buckets, full),
        "slice_info": lambda audio: s.slice_info(audio),
        "slice_fill": lambda cue, audio, bounds_ms, start_source=None, sources=None: s.slice_fill(cue, audio, bounds_ms, start_source, sources),
        "undo": lambda: s.undo(),
        "redo": lambda: s.redo(),
        "history_go": lambda steps: s.history_go(steps),
        "build": lambda bump=True: s.build(bump),
        "import_patch": lambda path, mode="add": s.import_patch(path, mode),
        "mod_scan": lambda path: s.mod_scan(path),
        "mod_preview": lambda path, picks=None: s.mod_preview(path, picks),
        "import_mod": lambda path, picks=None, name="", folder="", texts=None, keep_id=True, icon=True, mode="add",
            tabs=None: s.import_mod(path, picks, name, folder, texts, keep_id, icon, mode, tabs),
        "repatch_scan": lambda path: s.repatch_scan(path),
        "repatch": lambda path, name="", folder="", every_bank=False: s.repatch(path, name, folder, every_bank),
        "combine_scan": lambda path: s.combine_scan(path),
        "combine_installed": lambda: s.combine_installed(),
        "combine_folder": lambda: s.combine_folder(),
        "combine_read": lambda mods: s.combine_read(mods),
        "combine": lambda mods, winners=None, name="", folder="", every_bank=False:
            s.combine(mods, winners, name, folder, every_bank),
        "check_mods": lambda: s.check_mods(),
        "export_options": lambda cue: s.export_options(cue),
        "play_through": lambda cue, side="game", variants=None, loops=1, fight=None: s.play_through(cue, side, variants, loops, fight),
        "playlist_map": lambda cue: s.playlist_map(cue),
        "soundtrack_set": lambda pieces, label="soundtrack": s.soundtrack_set(pieces, label),
        "song_fill": lambda cue, audio, bounds_ms, segments=None: s.song_fill(cue, audio, bounds_ms, segments),
        "tracks_fill": lambda cue, files, shuffle=False, segments=None: s.tracks_fill(cue, files, shuffle, segments),
        "playlist_set": lambda cue, places, shuffle=None, resume=None: s.playlist_set(cue, places, shuffle, resume),
        "soundtrack_copy": lambda cue, to: s.soundtrack_copy(cue, to),
        "export": lambda cue, folder, **o: s.export(cue, folder, **o),
        "export_list": lambda entries, folder, **o: s.export_list(entries, folder, **o),
        "export_preview": lambda entries, **o: s.export_preview(entries, **o),
        "tutorial_audio": lambda kind: s.tutorial_audio(kind),
        "text_languages": lambda: s.text_languages(),
        "text_search": lambda language, query="", mine=False, limit=300, ids=None: s.text_search(language, query, mine, limit, ids),
        "text_alike": lambda id: s.text_alike(id),
        "text_voices": lambda ids, language: s.text_voices(ids, language),
        "text_set": lambda table, id, text: s.text_set(table, id, text),
        "text_revert": lambda lines: s.text_revert(lines),
        "job": lambda id: s.job(id),
        "job_cancel": lambda id: s.cancel_job(id),
        "reveal": lambda path: reveal(path),
        "releases": lambda force=False: updates.releases(force),
        "list_audio": lambda folder: list_audio(folder),
        "clipboard_files": lambda: clipboard_files(),
    }


MAX_BODY = 16 << 20  # bytes: a request's arguments (the longest is an export list)


def _not_json(name):
    raise ValueError(f"{name} isn't a number JSON allows")  # NaN and Infinity, which Python's json would take


def byte_range(header: str, size: int):
    """The (start, end) bytes a Range header asks for, None to send the whole file, "unsatisfiable" for a range
    the file can't give (416). Only the first range of several is served, and units other than bytes are ignored."""
    if not header.startswith("bytes="):
        return None
    a, sep, b = header[6:].split(",")[0].strip().partition("-")
    try:
        if not sep:
            return "unsatisfiable"
        if not a.strip():  # the last b bytes
            n = int(b)
            return (max(0, size - n), size - 1) if n > 0 and size else "unsatisfiable"
        start, end = int(a), int(b) if b.strip() else size - 1
    except ValueError:
        return "unsatisfiable"
    if start < 0 or start >= size or end < start:
        return "unsatisfiable"
    return start, min(end, size - 1)


def list_audio(folder):
    """The audio files in a folder, in natural name order: what a dropped folder brings in."""
    if not isinstance(folder, str) or not folder.strip():
        raise EditorError(tr("Choose a folder"))
    f = Path(folder)
    try:
        files = [p for p in f.iterdir() if p.suffix.lower() in AUDIO_TYPES]
    except OSError as e:
        raise EditorError(os_error(e, folder)) from None
    return sorted((str(p) for p in files), key=natural)


def clipboard_files():
    """The files copied in Explorer (the clipboard's file list) and the clipboard's change count, which tells whether
    they were copied after the slots Ctrl+C copied in the app. No files off Windows or while another program holds
    the clipboard."""
    if sys.platform != "win32":
        return {"files": [], "seq": 0}
    import ctypes
    from ctypes import wintypes
    user, shell = ctypes.windll.user32, ctypes.windll.shell32
    user.GetClipboardSequenceNumber.restype = wintypes.DWORD
    user.GetClipboardData.restype = ctypes.c_void_p
    shell.DragQueryFileW.argtypes = [ctypes.c_void_p, wintypes.UINT, wintypes.LPWSTR, wintypes.UINT]
    CF_HDROP = 15
    seq, files = user.GetClipboardSequenceNumber(), []
    if not user.IsClipboardFormatAvailable(CF_HDROP):
        return {"files": files, "seq": seq}
    for _ in range(5):  # another program can hold it for a moment
        if user.OpenClipboard(None):
            break
        time.sleep(0.02)
    else:
        return {"files": files, "seq": seq}
    try:
        if h := user.GetClipboardData(CF_HDROP):
            for i in range(shell.DragQueryFileW(h, 0xFFFFFFFF, None, 0)):
                buf = ctypes.create_unicode_buffer(shell.DragQueryFileW(h, i, None, 0) + 1)
                shell.DragQueryFileW(h, i, buf, len(buf))
                files.append(buf.value)
    finally:
        user.CloseClipboard()
    return {"files": files, "seq": seq}


def playable(path: Path) -> Path:
    """path itself if a browser plays it, else a cached WAV transcode (a .wem: the WAV vgmstream decodes)."""
    if path.suffix.lower() in BROWSER_AUDIO:
        return path
    if path.suffix.lower() == ".wem":
        return Path(wem.decoded(path))
    key = hashlib.sha1(f"{path.resolve()}:{path.stat().st_mtime_ns}".encode()).hexdigest()[:16]
    out = CACHE_DIR / "preview" / f"file-{key}.wav"
    with cache_lock(out):
        if not out.exists():
            out.parent.mkdir(parents=True, exist_ok=True)
            tmp = out.with_name(f"file-{key}.partial.wav")
            subprocess.run([wem.FFMPEG, "-v", "error", "-y", "-i", str(path), str(tmp)], check=True)
            tmp.replace(out)  # a request that comes in meanwhile must not stream a half-written file
    return out


def make_handler(session: Session, token: str):
    api = methods(session)

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        timeout = 60  # a request whose body never comes in full gives up instead of holding its thread for ever

        def log_message(self, *args):
            pass

        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Audiodiver-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")

        def _json(self, status, obj):
            try:
                body = json.dumps(obj, allow_nan=False).encode()  # NaN isn't JSON: the window couldn't read it
            except ValueError:
                log.error("an answer held a number JSON can't carry: %.300r", obj)
                status, body = 500, json.dumps({"error": tr("The core's answer held a number it can't send")}).encode()
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self):
            if self.headers.get("X-Audiodiver-Token") != token:
                return self._json(403, {"error": tr("The core refused the connection because of a wrong token")})
            name = self.path.removeprefix("/api/")
            try:
                n = int(self.headers.get("Content-Length") or 0)
                if not 0 <= n <= MAX_BODY:
                    raise ValueError(n)
                args = json.loads(self.rfile.read(n) or b"{}", parse_constant=_not_json)
            except (ValueError, UnicodeDecodeError, RecursionError, OSError):  # JSONDecodeError is a ValueError
                return self._json(400, {"error": "bad JSON"})
            if not isinstance(args, dict):
                return self._json(400, {"error": "bad JSON: the arguments are an object"})
            if name not in api:
                return self._json(404, {"error": f"no method {name}"})
            call = (name, time.time(), threading.get_ident())
            IN_FLIGHT.add(call)
            try:
                result = api[name](**args)
            except EditorError as e:
                return self._json(400, {"error": str(e)})
            except Exception as e:  # keep serving; the details go to the log, the words to the window
                log.exception("api %s failed", name)
                return self._json(400 if isinstance(e, (TypeError, ValueError, KeyError, OSError)) else 500,
                                  {"error": plain(e)})
            finally:
                IN_FLIGHT.discard(call)
            try:
                self._json(200, {"result": result})
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                pass  # the window stopped listening (a reload): the work is done all the same

        def do_GET(self):
            try:
                self._get()
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                pass  # the window stopped listening (a reload, another clip)
            except Exception as e:
                log.exception("GET %s failed", self.path.split("?")[0])
                try:
                    self._json(500, {"error": plain(e)})
                except OSError:
                    pass

        def _get(self):
            url = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(url.query)
            if url.path == "/health":
                return self._json(200, {"ok": True})
            if q.get("token", [""])[0] != token:
                return self._json(403, {"error": tr("The core refused the connection because of a wrong token")})
            parts = url.path.strip("/").split("/")
            try:
                if parts == ["project", "icon"]:  # the icon as the build packages it, or a preview of another
                    try:
                        preview = json.loads(q["icon"][0], parse_constant=_not_json) if q.get("icon") else None
                    except ValueError:
                        raise EditorError("Bad icon preview") from None
                    return self._bytes(session.icon(preview), "image/png")
                if parts == ["projects", "icon"]:
                    return self._bytes(project_icon(q.get("path", [""])[0]), "image/png")
                if parts == ["mods", "icon"]:
                    return self._bytes(*mod_icon(q.get("path", [""])[0]))
                if len(parts) != 3 and parts[:2] != ["audio", "file"]:
                    return self._json(404, {"error": "not found"})
                if parts[:2] == ["audio", "vanilla"]:
                    path = session.vanilla_wav(session._source(parts[2]))
                elif parts[:2] == ["audio", "project"]:
                    path = playable(session.project_audio(session._source(parts[2])))
                elif parts[:2] == ["audio", "file"] and q.get("path"):
                    f = Path(q["path"][0])
                    if f.suffix.lower() not in AUDIO_TYPES:  # nothing else is read or transcoded, whatever the path
                        raise EditorError(tr("{file} isn't an audio file").format(file=f.name))
                    if not f.is_absolute() or not f.is_file():
                        raise EditorError(tr("{path} wasn't found").format(path=f))
                    path = playable(f)
                else:
                    return self._json(404, {"error": "not found"})
            except EditorError as e:
                return self._json(404, {"error": str(e)})
            except (OSError, subprocess.CalledProcessError) as e:
                return self._json(404, {"error": plain(e)})
            self._file(path)

        def _bytes(self, data: bytes, content_type: str):
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)

        def _file(self, path: Path):
            size = path.stat().st_size
            rng = byte_range(self.headers.get("Range", ""), size)
            if rng == "unsatisfiable":
                self.send_response(416)
                self._cors()
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            start, end = rng or (0, size - 1)
            self.send_response(206 if rng else 200)
            self._cors()
            self.send_header("Content-Type", BROWSER_AUDIO.get(path.suffix.lower())
                             or mimetypes.guess_type(path.name)[0] or "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if rng:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                try:
                    while left > 0:
                        chunk = f.read(min(left, 1 << 20))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        left -= len(chunk)
                except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                    pass
    return Handler


def _exit_with_parent(pid: int, last=None):
    """Ends the process when process `pid` (the desktop app) ends, a crash included, after `last()` (the project's
    unsaved changes written), which gets 5 seconds.

    It waits on the process itself. The first version blocked a thread on reading stdin until the app closed it,
    and on Windows a blocked read on a standard handle deadlocks any native library loaded later whose start-up
    looks at the standard handles: `import numpy` hung forever, and with it the first export."""
    def finish():
        try:
            last()
        except Exception as e:  # noqa: BLE001 - the core exits either way
            log.warning("before exiting: %s", e)
    def watch():
        try:
            if os.name == "nt":
                import ctypes
                k = ctypes.windll.kernel32
                k.OpenProcess.restype = ctypes.c_void_p
                k.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
                handle = k.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
                if handle:  # no handle: the app is already gone
                    k.WaitForSingleObject(handle, 0xFFFFFFFF)
            else:
                while True:
                    os.kill(pid, 0)  # raises once the process is gone
                    time.sleep(1)
        except OSError:
            pass
        finally:
            log.info("the app (pid %s) is gone; core exiting", pid)
            if last:
                t = threading.Thread(target=finish, daemon=True)
                t.start()
                t.join(5)
            os._exit(0)
    threading.Thread(target=watch, daemon=True, name="parent-watch").start()


IN_FLIGHT = set()   # (api method, started, thread id) of the calls being answered
SLOW_CALL_SECONDS = 30   # play_through of a long cue is the slowest honest call


def watch_slow_calls():
    """Logs where a call is stuck once it runs far longer than any call should, so a hang leaves a trace."""
    import traceback
    reported = set()

    def loop():
        while True:
            time.sleep(5)
            for call in list(IN_FLIGHT):
                name, started, ident = call
                if call not in reported and time.time() - started > SLOW_CALL_SECONDS:
                    reported.add(call)
                    frame = sys._current_frames().get(ident)
                    log.warning("api %s has been running for %.0fs; it is here:\n%s", name, time.time() - started,
                                "".join(traceback.format_stack(frame)) if frame else "(thread gone)")
    threading.Thread(target=loop, daemon=True, name="slow-call-watch").start()


def start_log():
    """The core's log file (rotating): start-up, every job and every unexpected error. In the desktop app the core
    has no console, so this is the only trace a failure leaves."""
    import logging
    from logging.handlers import RotatingFileHandler
    from .editor import LOG_FILE, log
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)
    threading.excepthook = lambda a: log.error("thread %s crashed", a.thread.name if a.thread else "?",
                                               exc_info=(a.exc_type, a.exc_value, a.exc_traceback))
    return log


def serve(port=0, token=None, project=None, parent_pid=None):
    start_log()
    watch_slow_calls()
    log.info("core starting (pid %s, python %s)", os.getpid(), sys.version.split()[0])
    token = token or secrets.token_urlsafe(16)
    made = []  # the session, once there is one: the watch starts first, so the core never outlives the app
    if parent_pid:
        _exit_with_parent(int(parent_pid), lambda: made and made[0].flush())
    # the window's language at the last start, until the window says (set_language): the first steps of reading the
    # game show in it
    i18n.set_language(load_settings().get("language"))
    session = Session()
    made.append(session)
    if project:
        session.open_project(project)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(session, token))
    httpd.daemon_threads = True
    print("AUDIODIVER_SERVER " + json.dumps({"port": httpd.server_address[1], "token": token}), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
