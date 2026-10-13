#!/usr/bin/env python3
"""Merge the full NHHR collection review without publishing restricted originals."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from nhhr_mapping_connections import connect_collection_review

ROOT = Path(__file__).resolve().parents[1]
INPUTS = ['nhhr-root-catalogue-review.json', 'nhhr-research-catalogue-review.json', 'nhhr-regional-catalogue-review.json', 'nhhr-service-catalogue-review.json']
FOLLOWUPS = ['nhhr-facility-followup-review.json', 'nhhr-community-followup-review.json', 'nhhr-research-followup-review.json', 'nhhr-reference-followup-review.json', 'nhhr-chsa-connections-review.json']
ASSETS = ['atlas-snapshot', 'additional-evidence', 'population-ages', 'research-income', 'nursing-workforce', 'trial-sites', 'hospital-facilities', 'travel-network', 'clinical-condition-mix', 'trial-facility-conditions', 'public-expansion', 'research-expansion', 'regional-expansion', 'service-expansion', 'research-followup', 'community-followup', 'facility-followup', 'chsa-connections']

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    inventory = json.loads((ROOT / 'src/atlas/snapshots/source-inventory.json').read_text())
    datasets = []
    for asset in ASSETS:
        source = ROOT / 'src/atlas/snapshots' / (asset + '.json')
        public = ROOT / 'public/data/nhhr' / (asset + '.json')
        if source.read_bytes() != public.read_bytes(): raise ValueError('Module/public release differs: ' + asset)
        datasets.extend(json.loads(source.read_text())['datasets'])
    if len({d['id'] for d in datasets}) != len(datasets): raise ValueError('Duplicate explorer ID.')
    by_id = {d['id']: d for d in datasets}
    supplements = [d for d in datasets if d.get('sourceOrigin') == 'supplemental']
    by_source = {}
    for d in datasets:
        if d.get('sourceOrigin') != 'supplemental': by_source.setdefault(d['datasetId'], []).append(d)
    receipts = []; reviews = {}
    for filename in INPUTS:
        data = (ROOT / 'docs' / filename).read_bytes(); doc = json.loads(data)
        receipts.append({'file': filename, 'sha256': hashlib.sha256(data).hexdigest(), 'reviewCount': len(doc['reviews'])})
        for review in doc['reviews']:
            connect_collection_review(review)
            identity = review['datasetId']
            if identity in reviews: raise ValueError('Overlapping dataset audits: ' + identity)
            reviews[identity] = review
    # The earlier connected sources have already undergone original-file and
    # release checks. Preserve that narrower validation scope for larger packs.
    connected_receipts = json.loads((ROOT / 'docs/nhhr-connected-source-review.json').read_text())
    for review in connected_receipts['reviews']:
        if review['datasetId'] not in reviews: reviews[review['datasetId']] = review
    # Follow-ups can review different original tables in the same collection.
    # Join by Zoer UUID, retaining the earlier audit and each bounded decision.
    updates = {}; supplemental_reviews = {}
    for filename in FOLLOWUPS:
        data = (ROOT / 'docs' / filename).read_bytes(); doc = json.loads(data)
        receipts.append({'file': filename, 'sha256': hashlib.sha256(data).hexdigest(), 'reviewCount': len(doc['reviews']), 'kind': 'follow-up'})
        for review in doc.get('supplementalReviews', []):
            identity = review['datasetId']
            if identity in supplemental_reviews: raise ValueError('Duplicate publisher review: ' + identity)
            supplemental_reviews[identity] = review
        for review in doc['reviews']:
            identity = review['datasetId']
            if identity not in reviews: raise ValueError('Unknown follow-up dataset: ' + identity)
            updates.setdefault(identity, []).append(review)
    for identity, followups in updates.items():
        review = reviews[identity]
        review['earlierDecision'] = {k: review.get(k) for k in ['status', 'summary', 'mapConnection', 'needs', 'cannot', 'inspectionScope']}
        review['followupReviews'] = followups
        for field in ['summary', 'mapConnection', 'inspectionScope']:
            if any(r.get(field) and not isinstance(r[field], str) for r in followups): raise ValueError('Follow-up text must be a string: ' + identity + '/' + field)
            values = list(dict.fromkeys(r[field] for r in followups if r.get(field)))
            if values: review[field] = ' '.join(values)
        review['views'] = list(dict.fromkeys(review.get('views', []) + [value for r in followups for value in r.get('views', [])]))
        for field in ['needs', 'cannot']:
            review[field] = list(dict.fromkeys(value for r in followups for value in r.get(field, [])))
        review['evidence'] = review.get('evidence', []) + [e for r in followups for e in r.get('evidence', [])]
        statuses = {r.get('status') for r in followups}
        review['status'] = 'connected' if 'connected' in statuses else next((r['status'] for r in followups if r.get('status')), review['status'])
        if review['collectionId'] == 'DATA-C049':
            review['mapConnection'] = 'The existing cancer view retains its exact December 2015 DGUID/HR_UID boundary join. ' + review['mapConnection']
            review['needs'].append('Other collection subfamilies, including incident/event records, retain their earlier source-specific review gaps; this follow-up validates the released graduate, occupation and hospital-directory tables only.')
            review['needs'].extend(item.replace('inspect hospital location identity; province-only graduate chart needs rounded/projection labels; ', '') for item in review['earlierDecision'].get('needs', []))
            review['cannot'] = list(dict.fromkeys(review['cannot'] + review['earlierDecision'].get('cannot', [])))
        elif review['collectionId'] == 'DATA-C012':
            review['needs'].append('Operating accounts, sector facts and other report extracts remain outside the reviewed capital-project tables; their source definitions, units and periods require separate validation.')
        elif review['collectionId'] == 'DATA-C016':
            review['mapConnection'] = 'The existing chair listing retains eight reviewed institutional campus references. ' + review['mapConnection']
            review['needs'].extend(item.replace('Community-health indicators need heading/value reconstruction and source-period checks; ', '') for item in review['earlierDecision'].get('needs', []))
            review['cannot'] = list(dict.fromkeys(review['cannot'] + review['earlierDecision'].get('cannot', [])))
            review['needs'] = [item.replace('Actual CHSA scientific observations; the 309-row locations catalogue does not supply CHSA measurements.', 'The collected C016 source still has no CHSA scientific observations; its 309-row catalogue supplies locations only. This Atlas mapping gap is filled separately by clearly attributed PHSA CDR2022 supplements.') for item in review['needs']]
        earlier_scope = review['earlierDecision'].get('inspectionScope')
        if earlier_scope: review['inspectionScope'] = 'Earlier audit scope: ' + earlier_scope + ' Follow-up scope: ' + review.get('inspectionScope', '')
    # C058 was split into seven distinct Zoer datasets that share one host
    # collection label. The authoritative join key is always the dataset UUID.
    expected = {c['datasetId'] for c in inventory['collections']}
    if set(supplemental_reviews) != {d['datasetId'] for d in supplements}: raise ValueError('Supplement review coverage differs.')
    if set(reviews) != expected: raise ValueError('Collection review coverage differs: ' + str(expected ^ set(reviews)))
    compact = []
    for collection in inventory['collections']:
        review = reviews[collection['datasetId']]
        views = by_source.get(collection['datasetId'], [])
        summary = {k: review.get(k, []) if k in ['needs', 'cannot'] else review.get(k, '') for k in ['collectionId', 'datasetId', 'status', 'summary', 'mapConnection', 'needs', 'cannot', 'inspectionScope']}
        summary['reviewId'] = review['collectionId']
        summary['collectionId'] = collection['collectionId']
        if views and summary['status'] != 'restricted': summary['status'] = 'connected'
        summary['views'] = [d['id'] for d in views]
        summary['relatedViews'] = list(dict.fromkeys([x for x in review.get('views', []) if x in by_id and x not in summary['views']] + [d['id'] for d in supplements if collection['datasetId'] in d.get('relatedZoerDatasetIds', [])]))
        original_kinds = {'reviewed-original', 'original-source', 'hash-verified-original', 'locked-original', 'originalFile'}
        inspected = {e.get('sha256') or e.get('source', {}).get('sha256') for e in review.get('evidence', []) if (e.get('fullOriginalHashVerified') is True or e.get('kind') in original_kinds) and (e.get('sha256') or e.get('source', {}).get('sha256'))}
        summary['originalFilesInspected'] = max(review.get('originalFilesInspected', 0), len(inspected))
        if not summary['inspectionScope']:
            summary['inspectionScope'] = 'Dataset endpoint and complete source-file/table inventory; original-file hashes and selected schemas or measures checked. Only the released measures have undergone the preparation checks; sensitive records were not read.'
        compact.append(summary)
    summary = {'reviewedAt': '2026-10-12', 'manifestRevision': 93, 'manifestUrl': inventory['manifestUrl'], 'collectionCount': len(compact), 'connectedSourceCollections': len(by_source), 'explorerViews': len(datasets), 'loadedRows': sum(len(d['rows']) for d in datasets), 'statusCounts': dict(sorted(Counter(r['status'] for r in compact).items())), 'releaseAssets': ASSETS, 'scope': 'All 85 public NHHR collection inventories and dataset endpoints reviewed, with actual originals inspected by source family. Only selected measures are validated and released. Metadata, repeated source copies and model coefficients are not independent scientific observations. Protected participant/consent collections and personal records are excluded.', 'audits': receipts}
    summary['primaryExplorerViews'] = len(datasets) - len(supplements)
    summary['supplementalViews'] = [{k: d.get(k, []) if k in ['relatedZoerDatasetIds', 'supplementalSources'] else d.get(k, '') for k in ['id', 'title', 'datasetId', 'sourceName', 'sourceUrl', 'timeLabel', 'notes', 'relatedZoerDatasetIds', 'supplementalSources']} for d in supplements]
    proposals = [
        {'title': 'Archived cancer incidence', 'status': 'connected', 'datasetId': 'historical-cancer-incidence', 'recommended': 'Connected: official December 2015 Statistics Canada boundaries, matched by original DGUID/HR_UID pairs.', 'reason': 'Three Northern HSDAs have archived polygons. The BC benchmark remains in charts and records without an overlapping province polygon.'},
        {'title': 'Combined North Coast and Nechako labour estimates', 'status': 'connected', 'datasetId': 'regional-employment-annual', 'recommended': 'Connected: verified union of PGMaps 2021 economic regions 5960 and 5970.', 'reason': 'Statistics Canada defines one combined LFS reporting area. Its source value is mapped once; blank source identifiers remain blank and the display key is explicitly derived.'},
        {'title': 'Finer community health maps', 'status': 'connected', 'datasetId': 'northern-chsa-incidence', 'recommended': 'Connected: supplementary PHSA incidence and lifetime-prevalence rates for 29 publicly listed Northern CHSAs, joined by native codes to matching 2018 display boundaries.', 'reason': 'The collected Zoer C016 extract has no CHSA scientific rows. New publisher measurements are attributed separately. Forty archived Ministry polygons from the Community Map of Canada mirror provide display context; current PGMaps polygons cannot replace the changed 2018 McBride/Valemount geography. Historical omitted cells and unreleased communities remain missing, and the mirror is used for visualization only.'},
        {'title': 'McMaster institutional comparator', 'status': 'connected', 'datasetId': 'cfi-projects-total', 'recommended': 'Connected: verified main-campus reference at 1280 Main Street West, Hamilton.', 'reason': 'The official university address agrees with independently retrieved OpenStreetMap campus geometry. Institution-wide totals are not allocated to a campus, individual project or nearby population.'},
    ]
    # Compact safe product view. Detailed receipts remain separate and are
    # deliberately redacted for the strategic collection and private workbooks.
    product = {**summary, 'reviews': compact, 'boundaryProposals': proposals, 'supplementalReviews': [{k: r.get(k, []) if k in ['needs', 'cannot'] else r.get(k, '') for k in ['datasetId', 'sourceOrigin', 'sourceName', 'sourceUrl', 'status', 'summary', 'mapConnection', 'needs', 'cannot']} for r in supplemental_reviews.values()], 'facilityLocationReviewAsset': 'facility-location-gap-review.json'}
    detailed = {**product, 'reviews': [], 'supplementalReviews': list(supplemental_reviews.values())}
    for c in inventory['collections']:
        r = reviews[c['datasetId']]
        if c['collectionId'] == 'DATA-C037':
            r = {**next(x for x in compact if x['collectionId'] == c['collectionId']), 'evidence': [{'kind': 'reviewed-aggregate-release', 'asset': 'trial-facility-conditions-provenance.json'}, {'kind': 'reviewed-aggregate-release', 'asset': 'clinical-condition-mix-provenance.json'}]}
        elif r['status'] == 'restricted':
            r = {**next(x for x in compact if x['datasetId'] == c['datasetId']), 'evidence': [{'kind': 'restricted-source-metadata-only', 'note': 'Private people/case records are excluded. Only catalogue context and the review decision are exposed.'}]}
        detailed['reviews'].append(r)
    markdown = ['# NHHR catalogue review · 12 October 2026', '', summary['scope'], '', f"**{summary['collectionCount']} collections · {summary['explorerViews']} explorer views · {summary['loadedRows']:,} loaded source rows.** Rows overlap across summaries and originals; this is not a count of distinct people, grants or studies.", '', '## Mapping connections and remaining gaps', '']
    for proposal in proposals: markdown.extend(['### ' + proposal['title'], '', proposal['recommended'], '', proposal['reason'], ''])
    markdown.extend(['## Publisher supplements', '', 'Publisher supplements are separate from the 85 collected Zoer catalogue entries. The 2011 NSERC recovery retains its collected C055 lineage and explicit mixed source origins.', ''])
    for r in supplemental_reviews.values(): markdown.extend(['### ' + r['sourceName'], '', r['summary'], '', r['mapConnection'], '', 'Remaining needs: ' + ' '.join(r.get('needs', [])), ''])
    markdown.extend(['[Facility location review](facility-location-gap-review.json): six verified civic-address parcel references and eleven remaining source-specific location decisions.', ''])
    markdown.extend(['## Collection decisions', '', '| Collection | Review result | Connection and remaining work |', '|---|---|---|'])
    inventory_by_id = {c['datasetId']: c for c in inventory['collections']}
    for r in compact:
        collection = inventory_by_id[r['datasetId']]
        identity = r['reviewId'] if r['reviewId'] != r['collectionId'] else r['collectionId']
        name = collection['name'].replace('|', '\\|').replace('\n', ' ')
        label = ('[' + identity + '](' + collection['datasetUrl'] + ')' if collection.get('datasetUrl') else identity) + ' · ' + name
        text = r['summary'] + ' ' + r['mapConnection'] + (' Needed: ' + ' '.join(r['needs']) if r['needs'] else '')
        markdown.append('| ' + label + ' | ' + r['status'] + ' | ' + text.replace('|', '\\|').replace('\n', ' ') + ' |')
    outputs = {ROOT / 'src/atlas/snapshots/catalogue-review.json': product, ROOT / 'public/data/nhhr/catalogue-review.json': product, ROOT / 'docs/nhhr-catalogue-review.json': detailed, ROOT / 'public/data/nhhr/catalogue-review-evidence.json': detailed}
    for path, data in outputs.items():
        content = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
        if args.check:
            if not path.exists() or path.read_text() != content: raise ValueError('Catalogue review changed: ' + str(path))
        else: path.write_text(content)
    for path in [ROOT / 'docs/nhhr-catalogue-review.md', ROOT / 'public/data/nhhr/catalogue-review.md']:
        content = '\n'.join(markdown) + '\n'
        if args.check:
            if not path.exists() or path.read_text() != content: raise ValueError('Catalogue review changed: ' + str(path))
        else: path.write_text(content)
    print(json.dumps({k: summary[k] for k in ['collectionCount', 'connectedSourceCollections', 'explorerViews', 'loadedRows', 'statusCounts']}))

if __name__ == '__main__': main()
