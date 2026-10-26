"""Encodes any audio file to a Wwise Vorbis .wem that HD2 plays, without a Wwise install.

Pipeline: ffmpeg (decode, resample to 48 kHz, fold to mono/stereo) -> wav2wem (Vorbis) -> set the AkChannelConfig
wav2wem leaves zeroed (the game drops a source whose config is 0) and the codebook hash of the clip's own setup
(wav2wem writes one hash for every setup) -> vgmstream check.

    python -m audiodiver.wem input.(wav|flac|mp3|ogg|...) output.wem [-q 6]
"""
import glob, os, re, shutil, struct, subprocess, sys, tempfile, wave

RATE = 48000
WAV2WEM = shutil.which("wav2wem") or os.path.expanduser("~/go/bin/wav2wem.exe")
VGMSTREAM = shutil.which("vgmstream-cli") or r"C:\Tools\vgmstream\vgmstream-cli.exe"
FFMPEG = shutil.which("ffmpeg") or next(iter(glob.glob(os.path.expandvars(
    r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin\ffmpeg.exe"))), "ffmpeg")
FFPROBE = os.path.join(os.path.dirname(FFMPEG), "ffprobe") if os.path.dirname(FFMPEG) else "ffprobe"

# AkChannelConfig = channels | type << 8 | mask << 12, type 1 = standard; masks as Wwise writes them
CHANNEL_MASKS = {1: 0x4, 2: 0x3, 4: 0x603, 6: 0x60F}


def channel_config(channels: int) -> int:
    return channels | 1 << 8 | CHANNEL_MASKS[channels] << 12


def fmt_offset(data: bytes) -> int:
    """File offset of the fmt chunk payload."""
    assert data[:4] == b"RIFF" and data[8:12] == b"WAVE", "not a RIFF/WAVE file"
    pos = 12
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack_from("<I", data, pos + 4)[0]
        if cid == b"fmt ":
            return pos + 8
        pos += 8 + size + (size & 1)
    raise ValueError("no fmt chunk")


def length_ms(head: bytes) -> float | None:
    """How long a .wem plays, from its first bytes, or None when they don't say. Wwise Vorbis and Opus keep their
    sample count in the fmt chunk (64 bytes are enough); PCM and ADPCM need the data chunk's size as well."""
    try:
        if head[:4] != b"RIFF" or head[8:12] != b"WAVE":
            return None
        pos, rate, per_second = 12, 0, 0
        while pos + 8 <= len(head):
            cid, size = head[pos:pos + 4], struct.unpack_from("<I", head, pos + 4)[0]
            if cid == b"fmt ":
                tag, _channels, rate, per_second = struct.unpack_from("<HHII", head, pos + 8)
                if tag in (0xFFFF, 0x3041) and size >= 0x1C and rate:
                    return struct.unpack_from("<I", head, pos + 8 + 0x18)[0] * 1000 / rate
            elif cid == b"data":
                return size * 1000 / per_second if per_second else None
            pos += 8 + size + (size & 1)
    except struct.error:
        pass
    return None


def prefetch_size(data: bytes, mem: int) -> int:
    """How much of a streamed clip a bank keeps for a zero-latency start, in place of a clip that kept mem bytes:
    at least as much, and, as in every prefetch Wwise lays out, the whole header (seek table and setup packet) and
    whole packets after it. Cut inside the header, the game's Vorbis decoder crashed: a long song in place of a
    short piece has a longer seek table. A clip that isn't Wwise Vorbis as the game has it keeps min(mem, size)."""
    if len(data) <= mem:
        return len(data)
    try:
        fmt = fmt_offset(data)
        if struct.unpack_from("<H", data, fmt)[0] != 0xFFFF or struct.unpack_from("<I", data, fmt - 4)[0] != 0x42:
            return mem
        start, size = _data_chunk(data)
        end = min(len(data), start + size)
        at = start + struct.unpack_from("<I", data, fmt + 0x2C)[0]  # the first packet
        while True:
            at += 2 + struct.unpack_from("<H", data, at)[0]  # a packet: its size, then its bytes
            if at >= mem or at >= end:
                return min(at, len(data))
    except (ValueError, struct.error):
        return mem


def _data_chunk(data: bytes) -> tuple[int, int]:
    """(payload offset, size) of the data chunk."""
    pos = 12
    while True:
        cid, size = data[pos:pos + 4], struct.unpack_from("<I", data, pos + 4)[0]
        if cid == b"data":
            return pos + 8, size
        pos += 8 + size + (size & 1)


def codebook_hash(setup: bytes) -> int:
    """uHashCodebook as Wwise writes it: FNV-1 (32-bit) of the setup packet's bytes (all of the game's clips have
    it so)."""
    h = 0x811C9DC5
    for b in setup:
        h = ((h * 0x01000193) & 0xFFFFFFFF) ^ b
    return h


def with_codebook_hash(data: bytes) -> bytes:
    """The clip with the codebook hash of its own setup. The game decodes the clips playing at once that give one
    hash with one copy of the codebooks; wav2wem writes the hash of its 24 kHz mono setup on every clip, so a 48 kHz
    voice line played over a 24 kHz one decoded with the wrong codebooks and screeched. A clip that isn't Wwise
    Vorbis as the game has it, or has the right hash (the game's, Wwise's), is returned as it is."""
    try:
        fmt = fmt_offset(data)
        if struct.unpack_from("<H", data, fmt)[0] != 0xFFFF or struct.unpack_from("<I", data, fmt - 4)[0] != 0x42:
            return data
        start, size = _data_chunk(data)
        at = start + struct.unpack_from("<I", data, fmt + 0x28)[0]  # after the seek table: the setup packet
        n = struct.unpack_from("<H", data, at)[0]
        if at + 2 + n > min(len(data), start + size):
            return data
        h = codebook_hash(data[at + 2:at + 2 + n])
    except (AssertionError, ValueError, struct.error):
        return data
    if struct.unpack_from("<I", data, fmt + 0x3C)[0] == h:
        return data
    out = bytearray(data)
    struct.pack_into("<I", out, fmt + 0x3C, h)
    return bytes(out)


def fix_channel_config(data: bytearray) -> bytearray:
    """Sets AkChannelConfig (fmt+0x14) from the channel count if the encoder left it empty."""
    fmt = fmt_offset(data)
    tag, channels = struct.unpack_from("<HH", data, fmt)
    assert tag == 0xFFFF, f"not Wwise Vorbis (fmt tag {tag:#x})"
    if struct.unpack_from("<I", data, fmt + 0x14)[0] == 0:
        struct.pack_into("<I", data, fmt + 0x14, channel_config(channels))
    return data


def probe(wem: str) -> dict:
    """Decodes with vgmstream; returns {channels, rate, samples}."""
    out = subprocess.run([VGMSTREAM, "-m", wem], capture_output=True, text=True, check=True).stdout
    get = lambda pat: int(re.search(pat, out).group(1))
    return {"channels": get(r"channels: (\d+)"), "rate": get(r"sample rate: (\d+)"),
            "samples": get(r"stream total samples: (\d+)")}


def prepare_wav(src: str, wav: str) -> tuple[int, int]:
    """Decodes src to the 16-bit 48 kHz mono/stereo WAV the encoder takes; returns (channels, samples)."""
    channels = int(subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", src],
        capture_output=True, text=True, check=True).stdout.strip())
    channels = 1 if channels == 1 else 2
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-ac", str(channels), "-ar", str(RATE),
                    "-c:a", "pcm_s16le", wav], check=True)
    with wave.open(wav) as w:
        return channels, w.getnframes()


def encode(src: str, dst: str, quality: float = 6) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "in.wav")
        channels, samples = prepare_wav(src, wav)
        subprocess.run([WAV2WEM, "-q", str(quality), "-o", dst, wav], check=True, capture_output=True)
    with open(dst, "r+b") as f:
        data = with_codebook_hash(fix_channel_config(bytearray(f.read())))
        f.seek(0); f.write(data)
    info = probe(dst)
    assert info["channels"] == channels and info["rate"] == RATE, info
    assert info["samples"] == samples, f"length changed: {samples} -> {info['samples']} samples"
    return {**info, "seconds": samples / RATE, "bytes": len(data)}


if __name__ == "__main__":
    args = sys.argv[1:]
    q = float(args[args.index("-q") + 1]) if "-q" in args else 6
    src, dst = [a for i, a in enumerate(args) if a != "-q" and (i == 0 or args[i - 1] != "-q")]
    print(encode(src, dst, q))
