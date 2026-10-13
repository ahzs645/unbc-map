"""Reviewed geography metadata; original scientific fields remain unchanged."""
LFS_ASSET = 'boundaries-lfs-er-2021.geojson'
COMBINED_CODE = 'lfs-north-coast-nechako-2021'
COMBINED_LABEL = 'North Coast and Nechako, British Columbia'
ER_CODES = {'5910', '5920', '5930', '5940', '5950', '5980'}

def connect_reviewed_geography(dataset):
    identity = dataset['id']
    if identity == 'historical-cancer-incidence':
        dataset.update(geography='hr2015', boundaryKeyField='source_dguid', mapLocationsAsset='boundaries-hr2015.geojson')
        dataset['notes'][1] = 'The three Northern HSDAs join the official December 2015 Statistics Canada boundary release through exact original DGUID/HR_UID pairs. The BC aggregate remains in charts and records without an overlapping province polygon. The archive member is labelled September 2015; the publisher identifies this release as December 2015 limits. No current health polygons are substituted.'
    elif identity in ['regional-employment-annual', 'regional-labour-monthly']:
        dataset.update(boundaryKeyField='map_region_code', mapLocationsAsset=LFS_ASSET)
        dataset['columns'].append({'key': 'map_region_code', 'label': 'Reviewed display geography key (derived)', 'type': 'text'})
        for row in dataset['rows']:
            if row['region_name'] == COMBINED_LABEL:
                assert row['er_code'] is None and not row.get('source_dguid'), 'Combined source identity changed.'
                row['map_region_code'] = COMBINED_CODE
                if 'geography_note' in row:
                    row['geography_note'] = 'One combined LFS reporting area: union of native 2021 ERs 5960 and 5970; derived display key, not a source DGUID.'
            else:
                assert row['er_code'] in ER_CODES and row['source_dguid'] == '2021S0500' + row['er_code'], 'Native 2021 ER identity changed.'
                row['map_region_code'] = row['er_code']
        dataset['notes'][2] = 'North Coast and Nechako are one combined LFS reporting area. Statistics Canada’s 2025 guide confirms the 2021 geography; the map dissolves PGMaps ERs 5960 and 5970 into one polygon. Its value is shown once and never split. Original blank DGUID and ER-code fields remain blank; map_region_code is explicitly derived.'
        dataset['notes'].append('The seven display areas are disjoint reporting contexts. LFS target-population exclusions, including people living on reserves, still apply; coloured territory does not imply observations for every resident or location. Separate economic-region datasets retain their individual polygons.')
    elif identity == 'research-chairs':
        dataset['notes'][3] = 'All eight comparators use reviewed representative campus points, including McMaster’s main campus at 1280 Main Street West, Hamilton. Institution-wide counts are not allocated to one campus or surrounding residents.'
    elif identity in ['cfi-projects-total', 'cfi-projects-by-year']:
        dataset['notes'][4] = 'Unobserved institution/year combinations are not synthesized as zero rows. No NOSM lead-institution record is added. All seven source institutions, including McMaster, have reviewed representative campus points. These points do not locate individual projects or equipment.'

def connect_collection_review(review):
    identity = review['collectionId']
    if identity == 'DATA-C016':
        review['mapConnection'] = 'Eight reviewed campus references, including McMaster. Historical cancer derivatives reconcile to original C049; that view now uses verified December 2015 health-region geometry.'
    elif identity == 'DATA-C049':
        review['mapConnection'] = 'Exact original 2015 DGUID/HR_UID pairs join the official December 2015 Statistics Canada release for three Northern HSDAs. The BC benchmark stays unallocated in records and charts. Other tables retain separate gaps: hospital points need address/coordinate verification; graduate supply is provincial; incidents are source-coordinate events.'
        review['needs'] = [item.replace('Review vintage-matched cancer boundaries; ', '') for item in review['needs']]
    elif identity == 'DATA-C039':
        review['mapConnection'] = 'All seven source institutions have reviewed representative campus points. McMaster’s official Hamilton main-campus address matches independently retrieved OpenStreetMap way 23122301.'
        review['needs'] = ['Historical institution names and collaborators need explicit identity/allocation rules for wider coverage.']
    elif identity == 'DATA-C006':
        review['mapConnection'] = 'Six exact 2021 ER DGUIDs join native polygons. North Coast and Nechako use one verified union of PGMaps ERs 5960 and 5970, consistent with the publisher’s combined LFS reporting geography. Its source DGUID remains blank.'
        review['needs'] = ['CMA records require exact CMA geometry, not city points. Older 2016 ER series remain separate and chart-only.']
    elif identity == 'DATA-C058-02':
        review['mapConnection'] = 'Seven 2021 LFS reporting areas: six exact native ERs and one verified union of North Coast 5960 and Nechako 5970. One combined value is retained; the derived display key does not replace a blank source DGUID.'
        review['needs'] = ['Confidence intervals are not included in the selected estimate rows; do not infer statistical significance from map shading.']
    else:
        return
    review['mappingConnectionReceipt'] = 'mapping-connections-provenance.json'
