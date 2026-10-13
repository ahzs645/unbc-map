import { useEffect, useId, useMemo, useState } from 'react';
import { boundaryAssetUrl } from './geography';

type Usage = 'used' | 'partial' | 'unused' | 'source-only' | 'unavailable';

interface AuditEntry {
  id: string;
  title: string;
  category: string;
  status: Usage;
  grain: string;
  geometry: string;
  vintage: string;
  rights: string;
  mapNow: string[];
  missing: string[];
  cannot: string[];
  next: string;
  sourcePaths: string[];
  verificationScope: string;
  reuseEvidence?: string;
}

interface AuditRelease {
  reviewedAt: string;
  scope: string;
  entries: AuditEntry[];
}

const usageLabels: Record<Usage, string> = {
  used: 'Used',
  partial: 'Partially used',
  unused: 'Not yet used',
  'source-only': 'Source only',
  unavailable: 'Unavailable',
};

const usages = Object.keys(usageLabels) as Usage[];
const textFields = ['id', 'title', 'category', 'grain', 'geometry', 'vintage', 'rights', 'next', 'verificationScope'] as const;
const listFields = ['mapNow', 'missing', 'cannot', 'sourcePaths'] as const;

function parseAudit(value: unknown): AuditRelease {
  if (!value || typeof value !== 'object') throw new Error('Invalid audit release');
  const release = value as Record<string, unknown>;
  if (typeof release.reviewedAt !== 'string' || typeof release.scope !== 'string' || !Array.isArray(release.entries)) {
    throw new Error('Incomplete audit release');
  }
  const ids = new Set<string>();
  for (const item of release.entries) {
    if (!item || typeof item !== 'object') throw new Error('Invalid audit entry');
    const entry = item as Record<string, unknown>;
    if (!textFields.every(field => typeof entry[field] === 'string') ||
      !listFields.every(field => Array.isArray(entry[field]) && (entry[field] as unknown[]).every(text => typeof text === 'string')) ||
      (entry.reuseEvidence !== undefined && typeof entry.reuseEvidence !== 'string') ||
      !usages.includes(entry.status as Usage) || ids.has(entry.id as string)) {
      throw new Error('Incomplete audit entry');
    }
    ids.add(entry.id as string);
  }
  return value as AuditRelease;
}

function reviewDate(value: string) {
  // Preserve the source calendar day independently of the viewer's time zone.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function EvidenceList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul>{items.map((text, index) => <li key={`${index}-${text}`}>{text}</li>)}</ul> : <p>{empty}</p>;
}

function reuseDescription(value: string) {
  if (value === 'zoer-source-equivalent') return 'The Atlas uses equivalent reviewed source records from the authorized Zoer collection. The PGMaps package was not directly imported.';
  if (value === 'candidate-evidence') return 'PGMaps supplied candidate place identities and source evidence for independent review. The registry was not imported in bulk.';
  if (value === 'not-reused') return 'This specific PGMaps product is not imported into the Atlas, even when a related source is represented.';
  return value;
}

export default function AtlasPgmapsAudit() {
  const [release, setRelease] = useState<AuditRelease | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [usage, setUsage] = useState<Usage | 'all'>('all');
  const [category, setCategory] = useState('all');
  const tableId = useId();
  const auditUrl = boundaryAssetUrl('pgmaps-data-audit.json');
  const reviewUrl = boundaryAssetUrl('pgmaps-data-audit.md');

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setRelease(null);
    fetch(auditUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Audit unavailable');
        return response.json();
      })
      .then(value => {
        const reviewed = parseAudit(value);
        if (!controller.signal.aborted) setRelease(reviewed);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [auditUrl, attempt]);

  const categories = useMemo(() => [...new Set(release?.entries.map(entry => entry.category) ?? [])].sort(), [release]);
  const visible = useMemo(() => {
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return (release?.entries ?? []).filter(entry => {
      if ((usage !== 'all' && entry.status !== usage) || (category !== 'all' && entry.category !== category)) return false;
      const text = [usageLabels[entry.status], entry.reuseEvidence ?? '', ...textFields.map(field => entry[field]), ...listFields.flatMap(field => entry[field])].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [release, search, usage, category]);

  return <section className="atlas-connections" aria-label="PGMaps data audit" data-testid="pgmaps-data-audit">
    <div className="atlas-section-heading"><div>
      <p className="atlas-eyebrow">{release ? `Reviewed ${reviewDate(release.reviewedAt)}` : 'Source inventory'}</p>
      <h2>PGMaps data and mapping gaps.</h2>
    </div></div>
    <p>This review identifies which PGMaps data families and products the Atlas uses, what can be mapped from the available data, and what each connection still needs. A technically possible map is a proposed method until the source has been reviewed and connected. Entries can overlap and do not represent distinct cohorts.</p>
    <p><a href={auditUrl} download>Download the audit JSON</a> · <a href={reviewUrl} target="_blank" rel="noreferrer">Read the full audit</a></p>

    {failed ? <div role="alert">
      <p>The PGMaps audit could not be loaded. Open the audit download to inspect the available source file, or try again.</p>
      <button type="button" className="atlas-text-button" onClick={() => setAttempt(value => value + 1)}>Try loading again</button>
    </div> : !release ? <p role="status">Loading the reviewed source inventory…</p> : <>
      <details className="atlas-source-notes">
        <summary>Review scope and usage labels</summary>
        <div>
          <p>{release.scope}</p>
          <dl>
            <dt>Used</dt><dd>A reviewed part of this family is connected in the Atlas.</dd>
            <dt>Partially used</dt><dd>Some source data or geography is connected; other parts need additional review or map methods.</dd>
            <dt>Not yet used</dt><dd>Available source assets are outside the current Atlas release. This label does not establish fitness for a new use.</dd>
            <dt>Source only</dt><dd>The review found source metadata, code, vendor files or remote references without a reviewed, connected scientific layer.</dd>
            <dt>Unavailable</dt><dd>A proposed or referenced layer is absent from the inspected local release.</dd>
          </dl>
          <p>Verification scope is stated for each family. Catalogue inspection does not validate every scientific row, coordinate or remote service. Basemap imagery and shared map code do not by themselves connect the analytical data.</p>
        </div>
      </details>
      <div className="atlas-filter-panel">
        <label className="atlas-filter-field">Search families and mapping gaps
          <span className="atlas-search"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Source, place, method or limitation" aria-controls={tableId} /></span>
        </label>
        <label className="atlas-filter-field">Usage in Atlas
          <select value={usage} onChange={event => setUsage(event.target.value as Usage | 'all')} aria-controls={tableId}>
            <option value="all">All usage labels</option>
            {usages.map(value => <option key={value} value={value}>{usageLabels[value]} ({release.entries.filter(entry => entry.status === value).length})</option>)}
          </select>
        </label>
        <label className="atlas-filter-field">Source family category
          <select value={category} onChange={event => setCategory(event.target.value)} aria-controls={tableId}>
            <option value="all">All categories</option>
            {categories.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p role="status" aria-live="polite">Showing {visible.length} of {release.entries.length} reviewed entries.{(search || usage !== 'all' || category !== 'all') && <> <button type="button" className="atlas-text-button" onClick={() => { setSearch(''); setUsage('all'); setCategory('all'); }}>Clear filters</button></>}</p>
      {visible.length ? <div className="atlas-data-table" id={tableId}>
        <div className="atlas-table-scroll" tabIndex={0} role="region" aria-label="PGMaps source families; scroll horizontally to see all columns">
          <table>
            <caption style={{ textAlign: 'left', padding: '12px' }}>Source-family use, available geometry and the next supported mapping method</caption>
            <thead><tr><th scope="col">Data family or product</th><th scope="col">Data-family use</th><th scope="col">Available geometry and map methods</th><th scope="col">Review and next step</th></tr></thead>
            <tbody>{visible.map(entry => <tr key={entry.id} data-source-family={entry.id}>
              <th scope="row"><h3 style={{ fontFamily: 'inherit', fontSize: 14, margin: '0 0 8px' }}>{entry.title}</h3><p>{entry.category}</p><p>{entry.grain}</p></th>
              <td>{usageLabels[entry.status]}</td>
              <td><p>{entry.geometry}</p><EvidenceList items={entry.mapNow} empty="No supported map method identified in this review." /></td>
              <td>
                <p>{entry.next}</p>
                <details className="atlas-source-notes" style={{ marginTop: 12 }}>
                  <summary>Sources and limits: {entry.title}</summary>
                  <div>
                    <dl style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>{entry.reuseEvidence && <><dt>How the Atlas reuses this source</dt><dd>{reuseDescription(entry.reuseEvidence)}</dd></>}<dt>Vintage</dt><dd>{entry.vintage}</dd><dt>Rights and attribution</dt><dd>{entry.rights}</dd><dt>Verification scope</dt><dd>{entry.verificationScope}</dd></dl>
                    <h4>What the connection needs</h4><EvidenceList items={entry.missing} empty="No additional requirement identified in this review." />
                    <h4>What the data cannot establish</h4><EvidenceList items={entry.cannot} empty="No further inference limit recorded in this review; the stated grain and scope still apply." />
                    <h4>PGMaps source paths</h4>
                    <ul style={{ overflowWrap: 'anywhere' }}>{entry.sourcePaths.map((path, index) => <li key={`${index}-${path}`}><code>{path}</code></li>)}</ul>
                  </div>
                </details>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </div> : <p>No source families match these filters. Clear the filters to return to the full review.</p>}
    </>}
  </section>;
}
