"""Verify the exact tracked public snapshot with Python's standard library."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'RELEASE_MANIFEST.json').read_text())
expected = {entry['path'] for entry in manifest['files']}
tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')) - {''}
assert tracked == expected | {'RELEASE_MANIFEST.json'}, 'Tracked file set differs from manifest'
for entry in manifest['files']:
    relative = Path(entry['path'])
    assert not relative.is_absolute() and '..' not in relative.parts, 'Unsafe manifest path'
    path = root / relative
    content = path.read_bytes()
    assert len(content) == entry['bytes'], entry['path']
    assert hashlib.sha256(content).hexdigest() == entry['sha256'], entry['path']
print(f"Verified {len(expected)} payload files plus RELEASE_MANIFEST.json")
