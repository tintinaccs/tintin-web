#!/usr/bin/env python3
"""Voz clonada local para el Estudio de Reels (Chatterbox multilingüe, licencia MIT).

Genera narración en español con el timbre de una grabación de referencia.
Corre en la propia computadora: la voz no se envía a ningún servicio externo.

Requisito obligatorio: un registro de consentimiento de la dueña de la voz
(JSON con "titular", "autoriza": true, "alcance", "fecha", "muestraAprobada").
Sin ese archivo el script se niega a generar audio.

Chatterbox agrega una marca de agua inaudible (Perth) a todo audio generado,
lo que permite identificarlo como sintético.

Uso:
  python3 voz_clonada.py --referencia ref.wav --consentimiento consentimiento.json \
      --texto "Hola, ¿cómo estás?" --salida voz.wav [--exageracion 0.5] [--cfg 0.5]
"""
import argparse
import json
import sys
from pathlib import Path


def validar_consentimiento(ruta: str) -> dict:
    try:
        datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise SystemExit(f"Consentimiento ilegible: {error}")
    faltan = [k for k in ("titular", "autoriza", "alcance", "fecha") if not datos.get(k)]
    if faltan or datos.get("autoriza") is not True:
        raise SystemExit(f"Consentimiento incompleto o no otorgado (faltan: {', '.join(faltan) or 'autoriza=true'})")
    return datos


def main() -> int:
    p = argparse.ArgumentParser(description="Narración con voz clonada (local)")
    p.add_argument("--referencia", required=True, help="WAV de la voz original (10 a 20 s, sin música)")
    p.add_argument("--consentimiento", required=True)
    p.add_argument("--texto", help="Texto a narrar")
    p.add_argument("--archivo-texto", help="Archivo con el texto (una frase por línea)")
    p.add_argument("--salida", required=True)
    p.add_argument("--idioma", default="es")
    p.add_argument("--exageracion", type=float, default=0.5, help="Expresividad 0.25-1.0")
    p.add_argument("--cfg", type=float, default=0.5, help="Ritmo/adherencia 0.2-1.0")
    p.add_argument("--temperatura", type=float, default=0.8)
    p.add_argument("--semilla", type=int, default=7)
    args = p.parse_args()

    consentimiento = validar_consentimiento(args.consentimiento)
    if args.archivo_texto:
        frases = [l.strip() for l in Path(args.archivo_texto).read_text(encoding="utf-8").splitlines() if l.strip()]
    elif args.texto:
        frases = [args.texto.strip()]
    else:
        raise SystemExit("Indicá --texto o --archivo-texto")

    import torch
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.manual_seed(args.semilla)
    modelo = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    pausa = torch.zeros(1, int(modelo.sr * 0.18))
    partes = []
    for frase in frases:
        wav = modelo.generate(
            frase,
            language_id=args.idioma,
            audio_prompt_path=args.referencia,
            exaggeration=args.exageracion,
            cfg_weight=args.cfg,
            temperature=args.temperatura,
        )
        partes.extend([wav.cpu(), pausa])
    audio = torch.cat(partes[:-1], dim=1)
    torchaudio.save(args.salida, audio, modelo.sr)
    meta = {
        "motor": "chatterbox-multilingual (MIT, local)",
        "marcaDeAgua": "Perth (inaudible, la agrega el motor)",
        "titular": consentimiento["titular"],
        "consentimiento": args.consentimiento,
        "referencia": Path(args.referencia).name,
        "frases": frases,
        "parametros": {"exageracion": args.exageracion, "cfg": args.cfg, "temperatura": args.temperatura, "semilla": args.semilla},
        "duracion": round(audio.shape[1] / modelo.sr, 3),
    }
    Path(args.salida + ".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
