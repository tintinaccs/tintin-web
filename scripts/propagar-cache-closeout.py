from pathlib import Path
import re
import subprocess

ROOT = Path('.')
AUDIT = ['node', 'scripts/auditar-versionado-cache.mjs']
PROBLEM_RE = re.compile(r'CONTENIDO CAMBIÓ SIN BUMP DE VERSIÓN: "([^"]+)" sigue con el tag "([^"]+)"')
LITERAL_RE = re.compile(r'(["\'])([^"\'?]+\.(?:css|js|mjs))\?v=([A-Za-z0-9._-]+)(["\'])')


def source_files():
    files = [p for p in ROOT.glob('*.html') if p.is_file()]
    for base in ('js', 'functions'):
        folder = ROOT / base
        if folder.exists():
            files.extend(p for p in folder.rglob('*') if p.is_file() and p.suffix in {'.js', '.mjs'})
    return files


def resolve_reference(source: Path, ref: str) -> str:
    if source.suffix == '.html':
        return ref.lstrip('./').replace('\\', '/')
    if ref.startswith('.'):
        resolved = (source.parent / ref).resolve().relative_to(ROOT.resolve())
        return resolved.as_posix()
    return ref.lstrip('./').replace('\\', '/')


def bump_references(target: str, old_tag: str, new_tag: str) -> int:
    changed = 0
    for source in source_files():
        text = source.read_text(encoding='utf-8')
        parts = []
        last = 0
        touched = False
        for match in LITERAL_RE.finditer(text):
            ref = match.group(2)
            tag = match.group(3)
            if tag != old_tag or resolve_reference(source, ref) != target:
                continue
            parts.append(text[last:match.start()])
            parts.append(f'{match.group(1)}{ref}?v={new_tag}{match.group(4)}')
            last = match.end()
            touched = True
        if touched:
            parts.append(text[last:])
            source.write_text(''.join(parts), encoding='utf-8')
            changed += 1
    return changed


def safe_slug(path: str) -> str:
    base = Path(path).stem.lower()
    return re.sub(r'[^a-z0-9]+', '-', base).strip('-')[:28] or 'asset'


def run_audit():
    return subprocess.run(AUDIT, text=True, capture_output=True)


for iteration in range(1, 13):
    result = run_audit()
    output = (result.stdout or '') + '\n' + (result.stderr or '')
    if result.returncode == 0:
        print(output.strip())
        print(f'cache propagation: verde tras {iteration - 1} ronda(s)')
        break

    problems = PROBLEM_RE.findall(output)
    if not problems:
        print(output)
        raise SystemExit('El audit de caché falló por un motivo que no es un bump propagable.')

    print(f'cache propagation ronda {iteration}: {len(problems)} archivo(s) requieren bump')
    for index, (target, old_tag) in enumerate(problems, start=1):
        new_tag = f'tintin-20260901-closeout-{safe_slug(target)}-{iteration}-{index}'
        count = bump_references(target, old_tag, new_tag)
        if count == 0:
            raise SystemExit(f'No se encontró una referencia real a {target}?v={old_tag}')
        print(f'  {target}: {old_tag} -> {new_tag} ({count} consumidor(es))')
else:
    raise SystemExit('La propagación de cache-busting no convergió en 12 rondas.')

# Consolida únicamente después de demostrar que todos los bumps son legítimos.
subprocess.run(['node', 'scripts/auditar-versionado-cache.mjs', '--write'], check=True)
final = run_audit()
print((final.stdout or '') + (final.stderr or ''))
if final.returncode != 0:
    raise SystemExit('El baseline consolidado no quedó verde.')
