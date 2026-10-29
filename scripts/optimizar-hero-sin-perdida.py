"""Generación offline opcional: Python + Pillow con WebP (sin dependencia de runtime/CI).
Conserva PNG originales, dimensiones, perfil ICC y todos los píxeles RGBA.
Si cambia un PNG, actualizar también la URL/tag de publicación en HTML y runtime.
Las pruebas de navegador comprueban de nuevo la igualdad al decodificar ambos formatos.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
folder = root / 'assets-tintin/images/home/hero-nuevo'
for device in ('desktop', 'mobile', 'tablet-horizontal', 'tablet-vertical'):
    source = folder / f'hero-nuevo-{device}.png'
    target = folder / f'hero-nuevo-{device}-lossless.webp'
    with Image.open(source) as original:
        original.save(target, format='WEBP', lossless=True, method=6,
                      icc_profile=original.info.get('icc_profile', b''))
        with Image.open(target) as optimized:
            if optimized.size != original.size or optimized.convert('RGBA').tobytes() != original.convert('RGBA').tobytes():
                target.unlink()
                raise ValueError(f'Codificación sin fidelidad exacta: {device}')
    print(f'{device}: {source.stat().st_size} → {target.stat().st_size} bytes')
