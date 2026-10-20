# Guided story maps

How the guided story maps are built, how the reader behaves on each screen
size, and the rules that keep chapter changes smooth. Read this before adding
a story, a chapter or a new kind of evidence, and update it when the reader's
behaviour changes. Working practice for the whole repository is in
[AGENTS.md](../AGENTS.md).

## Where things live

| Area | Files |
| --- | --- |
| Story definitions | `src/atlas/storyMaps.ts`, `expansionStoryMaps.ts`, `followupStoryMaps.ts` (`AtlasStoryMap`, `StoryMapChapter`) |
| Reader | `src/atlas/AtlasStoryMap.tsx`: toolbar and chapter rail, cover, `StorySidecar` slides, `ChapterEvidence`, kept views, warm-up, header behaviour, chapter text |
| Evidence views | `AtlasMap.tsx` (regions and points), `AtlasMapComparison.tsx` (swipe between two periods), `AtlasPairedAgeMaps.tsx` (share and count), `AtlasEstimateTrends.tsx` (estimates and a projection), `AtlasChart.tsx`, `AtlasConditionMix.tsx`, `ScenarioLab` in `AtlasStoryMap.tsx` |
| Chapter links | `src/atlas/useStoryChapterUrl.ts` restores `#chapter` inside the bounded reader |
| Styles | `story-maps.css` (reader and evidence), `unbc-atlas.css` (page shell, toolbar, header), `paired-age-maps.css`, `basemap.css` |
| What ships | `manifest/content.json` `storyMaps` switches; `manifest/pages.json` `stories.options` (see [manifest/README.md](../manifest/README.md)) |
| Shared components | `@pgmaps/geo-toolkit/stories/components` (`StorySidecar`, `useReadingSection`, `ExpandableMedia`); the toolkit's API.md "Project and story boundaries" has the general rules |

## Add a story or a chapter

1. **Write the chapter** in the story's definition file.
   - `id` becomes the shareable `#hash`. Never rename a published id.
   - Put the finding in the **first paragraph**. On phones only the first
     paragraph shows; method notes and caveats fold behind "More about this
     data".
   - Compute `takeaway` values and any numbers in the text from the reviewed
     rows (see the helpers at the top of `storyMaps.ts`), so a data refresh
     cannot leave the text behind. A missing value reads "Not available",
     never zero.
2. **Choose the evidence** (`chapter.evidence.kind`):

   | Kind | Use for | Notes |
   | --- | --- | --- |
   | `map` | One measure on regions or points | `metric`, `year`, `focusRegions` (outlined and fitted), `scaleDomain` to hold a colour range across chapters, `filters` |
   | `comparison` | The same measure in two periods | `metric` and `comparisonMetric` must share a unit; both maps share one colour domain, camera and basemap |
   | `paired` | Share and count of older people | Separate scales, shared camera and selection; tabs on narrow panels |
   | `trends` | Estimates with a labelled projection | Story panel shows the total, then one area per screen |
   | `chart` | Non-geographic measures | Keeps the source grain |
   | `scenario` | Hypothetical travel assumptions | Never presented as a forecast |

   A new kind needs a case in `ChapterEvidence`. If it draws a map, add it to
   `keptKinds` so it follows the rules below.
3. **Switch it on** in `manifest/content.json`. Datasets used by enabled
   stories are included automatically (`"include": "stories"`).
4. **Update the README** story table and counts.
5. **Test** (see [Tests](#tests)). `tests/story-maps.spec.ts` walks every
   chapter of the listed stories; add a new story's id to that list.

## How the reader behaves

### Wider than 700px

- The story is locked to the window. The reader scrolls inside it; text on
  the left, evidence on the right.
- The UNBC header shows on the cover. Reading past the cover slides it away by
  scrolling the page shell by the header's height, and it returns at the top
  of the reader. The reader is always a full window high, so the maps are
  never resized (a resize draws a blank frame). Hide and show use separate
  thresholds so the header cannot flicker.
- The chapter rail keeps the current chapter centred. A title too long for
  the rail scrolls back and forth (`fitTicker`); with reduced motion it ends in
  an ellipsis.
- "Back to all stories" ends the last chapter's text.

### 700px and narrower

- The page scrolls; the story toolbar sticks to the top and shows only the
  current chapter between its arrows.
- The evidence panel takes about two-fifths of the screen
  (`--atlas-media`: 240–340px).
- Takeaways are one line of emphasis; the lead paragraph shows and the rest
  folds.
- Map controls shrink to 36px icons, all on one row: basemap picker top left,
  expand top right, level with the paired-map tabs and the trends key.

### Evidence panel

- "Expand media" opens the full view, which adds the dataset heading, source
  line, captions and value tables (`.editorial-expandable.is-expanded`).
- Trends: one area per screen in the story panel at every width; the expanded
  view and the explorer keep the full grid. Each chart is drawn in its box's
  own pixels, so it fills the space while labels keep their size.
- A swipe comparison's hover card sits above both maps and lists both
  periods (`tipMetrics`), since the pointer may be over either side.

## Keeping chapter changes smooth

Starting a map is GPU set-up (a WebGL context, its canvas and shaders) that
blocks the page; once the style, tiles and boundaries are cached, network
loading is rarely the cost. These rules follow from that, and from measuring
the chapter 4 to 5 change in `northern-communities` (no long tasks once they
were applied).

1. **Change one map in place.** Region maps send their boundary file to
   MapLibre once (`sentBoundaries` in `AtlasMap.tsx`). A chapter changes each
   region's `value`, `focused` and `selected` through feature state, read in
   paint expressions; outlines show by opacity because feature state cannot
   drive filters. Re-sending the 4 MB file re-tiles every shape.
2. **Keep views mounted.** Map, comparison and paired views stay mounted once
   shown (`keptKinds`). A hidden view is `.atlas-chapter-view.is-dormant`:
   absolutely positioned at full size, `visibility: hidden`, `inert`, and
   without its `atlas-map-state` test id. Never unmount or `display: none` a
   map the reader will return to.
3. **Warm views before they are needed.** Once the shown map has loaded
   (`data-ready` and a settled basemap) and 700ms have passed, the story starts
   one hidden view per idle moment (`requestIdleCallback`), nearest chapter
   first (`byDistance`). A story uses at most three kinds of map view.
4. **Hide tabs, don't unmount them.** The paired Share/Count tabs keep both
   maps drawn.
5. **Never animate a map container's size.** Move surrounding chrome by
   scrolling or transforming it instead. Expanded media is `position: fixed`,
   so avoid transforms on its ancestors.

To measure a change, record long tasks in Playwright around the chapter step
(a `PerformanceObserver` for `longtask`), or a CPU profile through the Chrome
DevTools Protocol, on a `build:all` preview. Headless runs use software
WebGL, so absolute times are much slower than a real GPU; compare before and
after on the same machine.

## Tests

- Build first: `npm run build:all`. Then run the relevant specs, for example
  `npx playwright test tests/story-maps.spec.ts tests/condition-mix-and-age-pairs.spec.ts tests/basemap.spec.ts tests/public-atlas.spec.ts tests/catalogue-review.spec.ts --workers=3`.
- Test hooks: `story-reader[data-active-chapter]`, `story-evidence[data-chapter]`,
  and on the shown map only, `atlas-map-state` with `data-ready`,
  `data-basemap-status`, `data-rendered-features`, `data-camera` and
  `data-scale-domain`. Warmed hidden views exist on the page, so select the
  shown one with `.atlas-chapter-view:not(.is-dormant)`.
- `data-rendered-features` counts regions in view, so it changes with the map's
  size. A layout change that resizes story maps changes those expectations
  (`tests/catalogue-review.spec.ts`).
- Basemap readiness can exceed the 5s expectation timeout when many tests run
  in parallel on software WebGL. Before treating a failure as a regression,
  rerun it alone and compare with `main` under the same parallelism.
