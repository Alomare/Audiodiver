"""Adds the Wwise analysis chunk (`akd `) that the game's own .wem files carry and wav2wem leaves out.

The chunk holds the clip's HDR envelope: a peak level (dB) and a few (sample, attenuation dB) points. The music tree
enables the HDR envelope, so without it the game balances a replaced clip with no idea how loud it is. HD2's clips are
analysed with envelope sensitivity 0 (start, loudest point, end), which Wwise reproduces exactly (e.g. loadout_12:
peak -12 dB at sample 635040 in both).

Wwise does the analysis: a scratch project converts the same 48 kHz WAV wav2wem encodes (PCM, analysis only) through
WAAPI, and only its `akd ` chunk is spliced into our Vorbis .wem, so the audio and its proven header stay as they are.
"""
import hashlib, os, socket, struct, subprocess, tempfile, time
from pathlib import Path

from . import wem
from .index import CACHE_DIR

WWISE_CONSOLE = Path(os.environ.get("WWISEROOT", r"C:\Audiokinetic\Wwise2025.1.4.9062")) / \
    "Authoring/x64/Release/bin/WwiseConsole.exe"
PROJECT = CACHE_DIR / "wwise" / "akdproj" / "akdproj.wproj"
CACHE = CACHE_DIR / "akd"


def unavailable() -> str | None:
    """Why loudness analysis can't run on this computer (the Build tab says it next to the switch), or None."""
    import importlib.util
    if not WWISE_CONSOLE.exists():
        return "Needs Wwise installed on this computer"
    if importlib.util.find_spec("waapi") is None:  # only a copy of the core run by hand lacks it
        return "Needs the waapi-client package next to the core"
    return None
PORT = 8095
WU = "\\Containers\\Default Work Unit"
SENSITIVITY = 0


def chunks(data: bytes):
    """[(tag, payload offset, size)] of a RIFF file."""
    out, pos = [], 12
    while pos + 8 <= len(data):
        tag, size = data[pos:pos + 4], struct.unpack_from("<I", data, pos + 4)[0]
        out.append((tag, pos + 8, size))
        pos += 8 + size + (size & 1)
    return out


def get_chunk(data: bytes, tag: bytes):
    return next((data[o:o + n] for t, o, n in chunks(data) if t == tag), None)


def describe(akd: bytes) -> str:
    _g1, _g2, n, peak = struct.unpack_from("<ffIf", akd)
    pts = [struct.unpack_from("<IH", akd, 16 + 6 * i) for i in range(n)]
    return f"peak {peak:g} dB, points {[(round(p / wem.RATE, 2), -a) for p, a in pts]}"


def insert(data: bytes, akd: bytes) -> bytes:
    """Puts `junk`(2) + `akd ` before `data`, the layout of the game's files (fmt 66, hash 16, junk 2, akd, data)."""
    assert get_chunk(data, b"akd ") is None, "already has an akd chunk"
    at = next(o - 8 for t, o, _ in chunks(data) if t == b"data")
    extra = b"junk" + struct.pack("<I", 2) + bytes(2) + b"akd " + struct.pack("<I", len(akd)) + akd + bytes(len(akd) & 1)
    out = bytearray(data[:at] + extra + data[at:])
    struct.pack_into("<I", out, 4, len(out) - 8)
    return bytes(out)


class Wwise:
    """A WAAPI session on the scratch project (starts WwiseConsole's waapi-server when none is listening)."""

    def __enter__(self):
        from waapi import WaapiClient
        self.proc = None
        if not self._listening():
            if not PROJECT.exists():
                PROJECT.parent.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run([str(WWISE_CONSOLE), "create-new-project", str(PROJECT), "--platform", "Windows"],
                               check=True, capture_output=True)
            self.proc = subprocess.Popen([str(WWISE_CONSOLE), "waapi-server", str(PROJECT), "--wamp-port", str(PORT)],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(120):
                if self._listening():
                    break
                time.sleep(1)
        for _ in range(30):
            try:
                self.client = WaapiClient(f"ws://127.0.0.1:{PORT}/waapi")
                return self
            except Exception:
                time.sleep(1)
        raise RuntimeError("could not connect to WAAPI")

    def __exit__(self, *exc):
        self.client.disconnect()
        if self.proc:
            self.proc.terminate()

    @staticmethod
    def _listening():
        with socket.socket() as s:
            return s.connect_ex(("127.0.0.1", PORT)) == 0

    def analyse(self, wavs: dict[str, str]) -> dict[str, bytes]:
        """{name: 48 kHz wav path} -> {name: akd chunk}."""
        c, paths = self.client, [WU + "\\" + n for n in wavs]
        c.call("ak.wwise.core.audio.import", {"importOperation": "replaceExisting", "default": {"importLanguage": "SFX"},
               "imports": [{"audioFile": str(Path(w).resolve()), "objectPath": WU + "\\<Sound SFX>" + n}
                           for n, w in wavs.items()]})
        for p in paths:
            for k, v in (("OverrideHdrEnvelope", True), ("HdrEnableEnvelope", True),
                         ("HdrEnvelopeSensitivity", SENSITIVITY)):
                c.call("ak.wwise.core.object.setProperty", {"object": p, "property": k, "value": v})
        args = {"from": {"path": paths}, "transform": [{"select": ["children"]}]}
        ids = [s["id"] for s in c.call("ak.wwise.core.object.get", args, options={"return": ["id"]})["return"]]
        c.call("ak.wwise.core.audio.convert", {"objects": ids, "platforms": ["Windows"], "languages": ["SFX"]})
        out = {}
        for s in c.call("ak.wwise.core.object.get", args,
                        options={"return": ["parent.name", "convertedWemFilePath"]})["return"]:
            out[s["parent.name"]] = get_chunk(Path(s["convertedWemFilePath"]).read_bytes(), b"akd ")
        assert all(out.get(n) for n in wavs), f"Wwise wrote no akd for {[n for n in wavs if not out.get(n)]}"
        return out


def analyse_files(sources: list[Path]) -> dict[Path, bytes]:
    """akd chunk for each source audio file, cached by content (the same 48 kHz conversion wem.encode feeds wav2wem)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    keys = {src: hashlib.sha1(Path(src).read_bytes()).hexdigest()[:16] for src in sources}
    todo = {k: src for src, k in keys.items() if not (CACHE / f"{k}.akd").exists()}
    if todo:
        with tempfile.TemporaryDirectory() as tmp, Wwise() as ww:
            wavs = {}
            for k, src in todo.items():
                wavs[f"a{k}"] = os.path.join(tmp, f"a{k}.wav")
                wem.prepare_wav(str(src), wavs[f"a{k}"])
            for name, akd in ww.analyse(wavs).items():
                (CACHE / f"{name[1:]}.akd").write_bytes(akd)
    return {src: (CACHE / f"{k}.akd").read_bytes() for src, k in keys.items()}
