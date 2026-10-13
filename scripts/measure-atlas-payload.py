#!/usr/bin/env python3
"""Measure reviewed website data and optional build bytes without raw source caches."""
import argparse
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def measure(path):
    raw = path.read_bytes()
    return {'file': str(path.relative_to(ROOT)), 'bytes': len(raw), 'gzipBytes': len(gzip.compress(raw, mtime=0))}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path); args = parser.parse_args()
    catalogue = json.loads((ROOT / 'public/data/nhhr/catalogue-review.json').read_text())
    snapshots = [measure(ROOT / 'public/data/nhhr' / (asset + '.json')) for asset in catalogue['releaseAssets']]
    public = [p for p in (ROOT / 'public/data/nhhr').rglob('*') if p.is_file()]
    geometry = [measure(p) for p in public if p.suffix == '.geojson']
    build = [p for p in (ROOT / 'dist').rglob('*') if p.is_file()]
    bundles = [measure(p) for p in (ROOT / 'dist/assets').glob('*.js') if 'worker' not in p.name]
    result = {
        'measuredAt': '2026-10-12', 'explorerViews': catalogue['explorerViews'], 'loadedRows': catalogue['loadedRows'],
        'snapshotBytes': sum(item['bytes'] for item in snapshots), 'snapshotGzipBytes': sum(item['gzipBytes'] for item in snapshots),
        'geometryBytes': sum(item['bytes'] for item in geometry), 'geometryGzipBytes': sum(item['gzipBytes'] for item in geometry),
        'nhhrPublicBytes': sum(p.stat().st_size for p in public), 'buildBytes': sum(p.stat().st_size for p in build),
        'bundles': bundles, 'snapshots': snapshots, 'geometry': geometry,
        'scope': 'Current published extracts, display geometry and optional production build. Raw/private source caches are excluded. Bytes use decimal units. Gzip bytes are computed examples, not an observed server transfer. The build also includes fonts and campus assets; map geometry is requested on demand. Snapshot JSON is currently bundled in the initial app script and also supplied as downloadable files.'
    }
    text = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(text)
    print(text)

if __name__ == '__main__': main()
