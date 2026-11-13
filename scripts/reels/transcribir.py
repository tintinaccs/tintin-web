#!/usr/bin/env python3
"""Transcripción local con marcas de tiempo por palabra para el Estudio de Reels.

Usa faster-whisper (licencia MIT) en la propia computadora: el audio no se envía
a ningún servicio externo. El modelo se descarga una sola vez desde Hugging Face.

Uso:
  python3 transcribir.py ARCHIVO [--modelo small] [--idioma es] [--salida transcripcion.json]

Salida JSON:
  {"motor": "faster-whisper", "modelo": "...", "idioma": "es", "duracion": s,
   "segmentos": [{"inicio": s, "fin": s, "texto": "...",
                  "palabras": [{"inicio": s, "fin": s, "texto": "..."}]}]}
"""
import argparse
import json
import subprocess
import sys


def leer_audio(archivo: str):
    """Decodifica con el ffmpeg del sistema a PCM mono 16 kHz (evita depender de PyAV)."""
    import numpy as np

    crudo = subprocess.run(
        ["ffmpeg", "-v", "error", "-nostdin", "-i", archivo, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(crudo, dtype=np.float32)


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcripción local con palabras sincronizadas")
    parser.add_argument("archivo")
    parser.add_argument("--modelo", default="small")
    parser.add_argument("--idioma", default="es")
    parser.add_argument("--salida", default="-")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper no está instalado"}), file=sys.stderr)
        return 3

    model = WhisperModel(args.modelo, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        leer_audio(args.archivo),
        language=args.idioma or None,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    salida = {
        "motor": "faster-whisper",
        "modelo": args.modelo,
        "idioma": info.language,
        "duracion": round(float(info.duration), 3),
        "segmentos": [],
    }
    for seg in segments:
        salida["segmentos"].append({
            "inicio": round(float(seg.start), 3),
            "fin": round(float(seg.end), 3),
            "texto": seg.text.strip(),
            "palabras": [
                {"inicio": round(float(w.start), 3), "fin": round(float(w.end), 3), "texto": w.word.strip()}
                for w in (seg.words or [])
                if w.word.strip()
            ],
        })
    texto = json.dumps(salida, ensure_ascii=False, indent=1)
    if args.salida == "-":
        print(texto)
    else:
        with open(args.salida, "w", encoding="utf-8") as fh:
            fh.write(texto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
