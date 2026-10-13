#!/usr/bin/env python3
"""Validate reviewed location evidence and export only bounded verification decisions.
Public output contains no scraped contact fields or original source documents.
"""
import argparse, hashlib, json
from pathlib import Path
from urllib.request import Request, urlopen
ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'scripts/nhhr-facility-location-gap-review.json'
def validate(cache, refresh=False):
    review = json.loads(REVIEW.read_text())
    for source in review['sources']:
        target = cache / source['filename']
        if refresh and (not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != source['sha256']):
            target.write_bytes(urlopen(Request(source['url'], headers={'User-Agent': 'NHHRAtlas-source-verification/1.0'}), timeout=45).read())
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Reviewed source changed or unavailable: ' + source['filename'])
    for site in review['verifiedCapitalLocations']:
        if refresh:
            live = json.loads(urlopen(Request(site['coordinateSourceUrl'], headers={'User-Agent': 'NHHRAtlas-source-verification/1.0'}), timeout=45).read())['features'][0]
            if not (live['geometry']['coordinates'] == site['coordinates'] and live['properties']['siteID'] == site['siteId'] and live['properties']['matchPrecision'] == site['matchPrecision']):
                raise ValueError('Live civic-address coordinate requires new review: ' + site['code'])
        receipt = json.loads((cache / site['geocoderReceipt']).read_text())
        feature = receipt['features'][0]
        properties = feature['properties']
        if not (feature['geometry']['type'] == 'Point' and feature['geometry']['coordinates'] == site['coordinates'] and properties['matchPrecision'] == 'CIVIC_NUMBER' and properties['score'] == site['score'] and properties['siteID'] == site['siteId']):
            raise ValueError('Reviewed coordinate identity/precision changed: ' + site['code'])
        if site['score'] < 99 or not site['siteId']:
            raise ValueError('Insufficient civic-address precision: ' + site['code'])
    for entry in review['remaining']:
        if entry.get('sha256') and hashlib.sha256((ROOT / 'public/data/nhhr' / entry['asset']).read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('Other-family source release changed: ' + entry['viewId'])
    return review

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=Path('/tmp/nhhr-facility-location-gap-review'))
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    args.input.mkdir(parents=True, exist_ok=True)
    review = validate(args.input, args.refresh)
    output = json.dumps(review, ensure_ascii=False, indent=2) + '\n'
    target = ROOT / 'public/data/nhhr/facility-location-gap-review.json'
    if args.check:
        if not target.exists() or target.read_text() != output:
            raise ValueError('Generated location review differs')
    else:
        target.write_text(output)
    print(('Checked' if args.check else 'Wrote') + ' 6 source-backed address-parcel references and 11 remaining-gap decisions.')
if __name__ == '__main__':
    main()
