"""Transcribe one speaker's WAV with faster-whisper (local, no network). Prototype.

Usage: python transcribe.py <audio.wav> <model_dir>
Prints JSON: {"language": "he", "segments": [{"start": s, "end": s, "text": "..."}]}
Model used in QA: ivrit-ai/whisper-large-v3-turbo-ct2 (Apache-2.0, Hebrew fine-tune).
No transcript text is logged; it goes to stdout for the worker only.
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load_audio(path: str) -> np.ndarray:
    """16 kHz mono float32 via ffmpeg (avoids the PyAV decoder)."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> None:
    audio, model_dir = sys.argv[1], sys.argv[2]
    model = WhisperModel(model_dir, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        load_audio(audio),
        language="he",
        beam_size=5,
        vad_filter=True,  # skip silence between turns
        condition_on_previous_text=False,
    )
    out = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments if s.text.strip()]
    json.dump({"language": info.language, "duration": round(info.duration, 1), "segments": out}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
