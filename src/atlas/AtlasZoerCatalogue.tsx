import { useMemo, useState } from 'react';
import { atlasDatasets, atlasInventory } from './data';
import { boundaryAssetUrl } from './geography';
import type { AtlasDataset } from './types';
import reviewDocument from './snapshots/catalogue-review.json';

const reviewLabels: Record<string, string> = {
  connected: 'Connected extracts', supporting: 'Supporting source or copy', candidate: 'Further connection needed',
  metadata: 'Metadata or methods', restricted: 'Restricted records excluded', blocked: 'Source problem identified',
};
const reviewById = new Map(reviewDocument.reviews.map(review => [review.datasetId, review]));

export default function AtlasZoerCatalogue({ onExplore }: { onExplore: (dataset: AtlasDataset) => void }) {
  const [search, setSearch] = useState('');
  const [usage, setUsage] = useState('all');
  const [result, setResult] = useState('all');
  const collections = useMemo(() => atlasInventory.collections.map(collection => ({
    ...collection,
    // Compute current connections from the actual releases. The original
    // catalogue's loadedInAtlas flag only described its initial core release.
    views: atlasDatasets.filter(dataset => dataset.sourceOrigin !== 'supplemental' && dataset.datasetId === collection.datasetId),
    review: reviewById.get(collection.datasetId),
  })), []);
  const connected = collections.filter(collection => collection.views.length > 0).length;
  const supplements = atlasDatasets.filter(dataset => dataset.sourceOrigin === 'supplemental');
  const primaryViews = atlasDatasets.length - supplements.length;
  const visible = collections.filter(collection => {
    if (usage === 'connected' && !collection.views.length) return false;
    if (usage === 'catalogue' && collection.views.length) return false;
    if (result !== 'all' && collection.review?.status !== result) return false;
    const text = [collection.collectionId, collection.name, collection.sourceName, collection.datasetId,
      collection.review?.reviewId, collection.review?.summary, collection.review?.mapConnection,
      ...(collection.review?.needs ?? []), ...(collection.review?.cannot ?? []), ...collection.views.map(view => view.title)].join(' ').toLowerCase();
    return search.trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
  });

  return <><section className="atlas-connections" id="atlas-zoer" aria-label="NHHR Zoer datasets">
    <div className="atlas-section-heading"><div><p className="atlas-eyebrow">NHHR Data Space</p><h2>NHHR datasets in Zoer.</h2></div></div>
    <p>Browse the NHHR collections listed in Zoer. {connected} collections supply the {primaryViews} reviewed explorer views.{supplements.length > 0 && <> {supplements.length} supplementary views use separately attributed publisher data to fill mapping gaps.</>} A connected view uses selected records from its source collection; it does not load every table in that collection.</p>
    <p>All {reviewDocument.collectionCount} catalogue entries have a connection review. Open a row’s review to see its source grain, mapping method, remaining needs and limits. Only selected measures are validated and loaded; the review distinguishes inventories and supporting copies from additional observations.</p>
    <p>Table and row-reference counts describe catalogue metadata, including overlapping raw and derived tables and workbook grids. They are not distinct people, studies or records loaded into the explorer. Participant and consent collection details are omitted; restricted packages show only separately reviewed extracts.</p>
    <p><a href={atlasInventory.manifestUrl} target="_blank" rel="noreferrer">NHHR Data Space manifest</a> · <a href={boundaryAssetUrl('source-inventory.json')} download>Download NHHR catalogue metadata</a> · <a href={boundaryAssetUrl('catalogue-review.md')} target="_blank" rel="noreferrer">Read the full NHHR connection review</a> · <a href={boundaryAssetUrl('catalogue-review-evidence.json')} download>Verification receipts</a></p>
    <div className="atlas-filter-panel">
      <label className="atlas-filter-field">Search NHHR datasets<span className="atlas-search"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Dataset, publisher or collection ID" /></span></label>
      <label className="atlas-filter-field">Explorer connection<select value={usage} onChange={event => setUsage(event.target.value)}>
        <option value="all">All NHHR collections ({collections.length})</option>
        <option value="connected">Reviewed extracts in explorer ({connected})</option>
        <option value="catalogue">No primary explorer extract ({collections.length - connected})</option>
      </select></label>
      <label className="atlas-filter-field">Connection review<select value={result} onChange={event => setResult(event.target.value)}>
        <option value="all">All review results</option>
        {Object.entries(reviewLabels).map(([key, label]) => <option key={key} value={key}>{label} ({collections.filter(item => item.review?.status === key).length})</option>)}
      </select></label>
    </div>
    <p role="status">Showing {visible.length} of {collections.length} NHHR collections.{(search || usage !== 'all' || result !== 'all') && <> <button className="atlas-text-button" onClick={() => { setSearch(''); setUsage('all'); setResult('all'); }}>Clear filters</button></>}</p>
    {visible.length ? <div className="atlas-data-table"><div className="atlas-table-scroll" tabIndex={0} role="region" aria-label="NHHR dataset catalogue; scroll horizontally to see all columns">
      <table><thead><tr><th scope="col">NHHR collection</th><th scope="col">Source</th><th scope="col">Zoer catalogue</th><th scope="col">Explorer views and connection review</th></tr></thead>
        <tbody>{visible.map(collection => <tr key={collection.datasetId} data-zoer-dataset={collection.datasetId}>
          <th scope="row"><h3 style={{ fontFamily: 'inherit', fontSize: 14, margin: '0 0 8px' }}>{collection.name}</h3><p>{collection.collectionId}</p></th>
          <td>{collection.sourceName || 'NHHR reviewed source package'}</td>
          <td>{collection.tableCount === null ? <p>Restricted source package</p> : <p>{collection.tableCount.toLocaleString()} tables · {collection.catalogueRows?.toLocaleString()} row references</p>}
            {collection.datasetUrl && <a href={collection.datasetUrl} target="_blank" rel="noreferrer">Zoer dataset details</a>}</td>
          <td>{collection.views.length ? collection.views.map(view => <p key={view.id}><button className="atlas-text-button" onClick={() => onExplore(view)}>{view.title}</button>{view.sourceOrigin === 'mixed' && <small> · Includes a verified publisher recovery; see source notes.</small>}</p>) : <p>No primary explorer extract</p>}
            {collection.review && <details><summary>{reviewLabels[collection.review.status] ?? collection.review.status} · review</summary>
              <p>{collection.review.summary}</p><p><strong>Geographic connection: </strong>{collection.review.mapConnection}</p>
              {collection.review.needs.length > 0 && <><strong>Needed next</strong><ul>{collection.review.needs.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
              {collection.review.cannot.length > 0 && <><strong>Interpretation limits</strong><ul>{collection.review.cannot.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
              <p>{collection.review.inspectionScope}</p>
              {collection.review.relatedViews.length > 0 && <p>Related reviewed views: {collection.review.relatedViews.map((id, index) => { const view = atlasDatasets.find(item => item.id === id); return view ? <span key={id}>{index > 0 && ' · '}<a href={`${import.meta.env.BASE_URL}dev/projects?view=explore&dataset=${encodeURIComponent(id)}`}>{view.title}</a></span> : null; })}</p>}
            </details>}
          </td>
        </tr>)}</tbody>
      </table>
    </div></div> : <p>No NHHR datasets match these filters.</p>}
    <div className="atlas-section-heading" style={{ marginTop: 32 }}><div><h3>Mapping connections and remaining gaps</h3></div></div>
    <p>Historical cancer regions, the combined North Coast–Nechako labour region and McMaster’s campus reference are connected. The source reviews below identify CHSA coverage and any remaining mapping needs. <a href={boundaryAssetUrl('mapping-connections-provenance.json')} download>Mapping verification receipts</a> · <a href={boundaryAssetUrl("facility-location-gap-review.json")} download>Remaining facility location review</a></p>
    {reviewDocument.boundaryProposals.map(proposal => <details key={proposal.title}><summary>{proposal.title}</summary><p>{proposal.recommended}</p><p>{proposal.reason}</p>{proposal.datasetId && atlasDatasets.some(item => item.id === proposal.datasetId) && <p><a href={`${import.meta.env.BASE_URL}dev/projects?view=explore&dataset=${encodeURIComponent(proposal.datasetId)}`}>Explore the reviewed source view</a></p>}</details>)}
  </section>
    {supplements.length > 0 && <section aria-label="Verified source supplements">
      <div className="atlas-section-heading" style={{ marginTop: 32 }}><div><h3>Publisher data connected to the mapping gaps</h3></div></div>
      <p>These measurements were retrieved from the named publisher. They are separate from the 85 NHHR Zoer catalogue entries; source notes retain reporting periods, geographic scope and verification limits.</p>
      <div className="atlas-data-table"><div className="atlas-table-scroll" tabIndex={0} role="region" aria-label="Publisher supplements; scroll horizontally to see all columns"><table>
        <thead><tr><th scope="col">Reviewed view</th><th scope="col">Publisher and period</th><th scope="col">Source and scope</th></tr></thead>
        <tbody>{supplements.map(view => <tr key={view.id}><th scope="row"><button className="atlas-text-button" onClick={() => onExplore(view)}>{view.title}</button></th><td>{view.sourceName}<p>{view.timeLabel}</p></td><td><a href={view.sourceUrl} target="_blank" rel="noreferrer">Publisher source</a><details><summary>Source, geography and limits</summary><ul>{view.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details></td></tr>)}</tbody>
      </table></div></div>
    </section>}
  </>;
}
