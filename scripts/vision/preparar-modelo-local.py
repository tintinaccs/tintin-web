"""Reproduce los assets de visión. Uso: python preparar-modelo-local.py CACHE.

Sólo herramienta de desarrollo, con numpy, onnx, onnxruntime y tokenizers.
El navegador usa únicamente el grafo visual y embeddings fijos; no descarga
modelos, código ni tokenizadores de terceros durante el uso del editor.
"""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

import numpy as np
import onnx
import onnxruntime as ort
from tokenizers import Tokenizer

REVISION = '737108a175dc6c043d9e64cf738baa91a272f7cb'
MODEL = 'onnx-community/TinyCLIP-ViT-40M-32-Text-19M-LAION400M-ONNX'
CACHE = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets-tintin/vision'
LABELS = [
    ('bag', 'Cartera', 'a handbag', 'a purse'),
    ('earrings', 'Aros', 'a pair of earrings', 'earrings jewelry'),
    ('necklace', 'Cadena o collar', 'a necklace', 'a jewelry chain necklace'),
    ('bracelet', 'Pulsera', 'a bracelet', 'a wrist bracelet'),
    ('watch', 'Reloj', 'a wristwatch', 'a watch'),
    ('ring', 'Anillo', 'a finger ring', 'a jewelry ring'),
    ('hair', 'Accesorio para el pelo', 'a hair clip', 'a hair accessory'),
    ('keyring', 'Llavero', 'a keychain', 'a key ring accessory'),
    ('wallet', 'Billetera', 'a wallet', 'a small leather wallet'),
    ('cuff', 'Brazalete', 'a cuff bracelet', 'a wide bangle bracelet'),
    ('earcuff', 'Earcuff', 'an ear cuff', 'ear cuff jewelry'),
    ('anklet', 'Tobillera', 'an anklet', 'an ankle chain bracelet'),
    ('organizer', 'Joyero', 'a jewelry box', 'a jewelry organizer'),
    ('sunglasses', 'Gafas', 'a pair of sunglasses', 'eyeglasses'),
    ('other', 'Otro producto', 'a shoe', 'an item of clothing'),
    ('other', 'Otro producto', 'a cosmetic bottle', 'a perfume bottle'),
    ('other', 'Sin producto reconocible', 'a landscape', 'a person'),
    ('other', 'Sin producto reconocible', 'a blank white background', 'a blurry photograph'),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(name):
    path = CACHE / name.rsplit('/', 1)[-1]
    if not path.exists():
        urllib.request.urlretrieve(f'https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}', path)
    return path


CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
model = download('onnx/model_quantized.onnx')
if digest(model) != '5e9390262b0eb80caec3eb878acc8b77e116570a2d3b8ea4a59d13029d6f3329':
    raise ValueError('El modelo descargado no coincide con la revisión aprobada')
tokenizer_path = download('tokenizer.json')
tokenizer = Tokenizer.from_file(str(tokenizer_path))
tokenizer.enable_truncation(max_length=77)
tokenizer.enable_padding(length=77, pad_id=49407, pad_token='<|endoftext|>')
prompts = [f'a product photo of {text}.' for _, _, *texts in LABELS for text in texts]
encoded = tokenizer.encode_batch(prompts)
session = ort.InferenceSession(str(model), providers=['CPUExecutionProvider'])
embeddings = session.run(['text_embeds'], {
    'input_ids': np.array([item.ids for item in encoded], dtype=np.int64),
    'attention_mask': np.array([item.attention_mask for item in encoded], dtype=np.int64),
    'pixel_values': np.zeros((1, 3, 224, 224), dtype=np.float32),
})[0]
rows = []
for index, (key, label, *_texts) in enumerate(LABELS):
    vector = embeddings[index * 2:index * 2 + 2].mean(axis=0)
    vector /= np.linalg.norm(vector)
    rows.append({'key': key, 'label': label, 'embedding': [round(float(v), 8) for v in vector]})
output_model = CACHE / 'tinyclip-vision-int8-v1.onnx'
onnx.utils.extract_model(str(model), str(output_model), ['pixel_values'], ['image_embeds'])
model_bytes = output_model.read_bytes()
parts = []
for index, offset in enumerate(range(0, len(model_bytes), 22 * 1024 * 1024), start=1):
    part = OUT / f'tinyclip-vision-int8-v1.part{index}.bin'
    part.write_bytes(model_bytes[offset:offset + 22 * 1024 * 1024])
    parts.append(part)
(OUT / 'etiquetas-v1.json').write_text(json.dumps({'labels': rows}, ensure_ascii=False, separators=(',', ':')) + '\n')
manifest = {
    'model': MODEL, 'revision': REVISION, 'license': 'MIT',
    'sourceModelSha256': digest(model), 'tokenizerSha256': digest(tokenizer_path),
    'preparation': 'scripts/vision/preparar-modelo-local.py',
    'inputs': {'pixel_values': [1, 3, 224, 224]}, 'outputs': ['image_embeds'],
    'imageMean': [.48145466, .4578275, .40821073], 'imageStd': [.26862954, .26130258, .27577711],
    'modelSha256': digest(output_model), 'parts': [p.name for p in parts],
    'assets': {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in [*parts, OUT / 'etiquetas-v1.json']},
}
(OUT / 'procedencia.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v['bytes'] for k, v in manifest['assets'].items()}))
