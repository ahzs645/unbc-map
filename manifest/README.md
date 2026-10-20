# Build manifest

These files decide what the published site contains. They are read at build
time (`scripts/manifest.mjs`, wired into `vite.config.ts`), so anything switched
off here is **left out of the build**, not hidden in the page: its code is
minified away, and disabled stories, story maps and their datasets are cut from
the sources before bundling. Edit a file, then `npm run build` (the dev server
restarts by itself when a manifest file changes).

`npm run dev:all` and `npm run build:all` (`ATLAS_MANIFEST=all`) ignore these
switches: every project, page, option and story is on and no password is asked.
The main browser suite runs on that build.

## `projects.json`: the three sites

| Project | Address | |
| --- | --- | --- |
| `atlas` | `/` | The public NHHR Atlas |
| `workspace` | `/dev/projects` | The same Atlas with its Zoer workspace details |
| `campus` | `/campus` | The UNBC Campus Explorer |

- `enabled: false` gives the project no entry pages and shows "Page not available" at its address.
- `password: true` puts it behind the password in `access.json`.

## `access.json`: the password

A safeguard against casual visitors, not security. Only the password's SHA-256
is stored, here and in the built site, so this public repository never holds the
password itself. Set a new one with:

```sh
npm run manifest:password -- <new password>
```

Everything behind the gate still ships in the public JavaScript, and anyone
determined can read it. An unlock lasts
`rememberHours` (4) in that browser, then the password is asked again;
changing the password asks everyone again straight away. Keep anything truly
private out of the build instead, by switching it off.

## `pages.json`: Atlas pages and their options

| Page | Switch | Options |
| --- | --- | --- |
| `home` | The front page at `/`. When it is on, stories move to `/stories` | — |
| `stories` | Always on (the Atlas's landing content) | `storyCardMeta`: kicker and badge on story cards · `storyMapCardMeta`: topic and chapter count on story-map cards · `storyByline`: badge, period and "Copy story link" on a story · `storyScopeNote`: the geography note on a story · `storyMapValues`: the "Read the regional values" table under each story-map chapter's map |
| `explore` | The data explorer. When it is off, every "Explore" link goes, and the header search finds stories | `filters`: measure, period, entity, extra filters, record search and "Clear filters" · `chart`, `map`, `pairedMaps`: those display tabs. The table is always there · `datasetDetails`: record count, geography and period under the dataset title and in the dataset list · `mapIcons`: the map icon on mappable datasets in the list |
| `sources` | Sources and methods | — |

With `filters` off, the explorer shows each dataset's full records in the
table, and charts or maps use the dataset's default view. Older shared links
lose their filter parameters.

## `home.json`: the home page's words

Every heading, paragraph, card and link label on the home page. Placeholders
fill in from what the build contains, so the copy stays true when stories are
switched on or off:

- `{topics}`: the topics of the switched-on stories, as a list ("communities, workforce and population").
- `{storyMaps}`, `{stories}`, `{datasets}`: a count, or with words, `{stories:short story|short stories}` → "4 short stories".

`context` (the side panel), `note` and any of the `cards` can be `null` to
leave them out (a card set to `null` only leaves the home page; the page itself
stays). Cards for switched-off pages are left out automatically. The build fails on a
missing field or an unknown placeholder.

## `site.json`: across every page

- `statusBadges`: the Projection / Scenario / Source records badges.
- `campusLinks`: "Campus map" in the Atlas header menu and tabs.
- `sourcesInMenu`: "Sources & methods" in the header menu (the section tab stays).

## `content.json`: stories and data

- `storyMaps`, `stories`: every story in the sources, by id, as `true` or `false`.
  The build fails on an unknown id or on a story that is not listed, so a new
  story has to be added here before it ships.
- `datasets.include`: `"stories"` keeps only the datasets the switched-on
  stories read (the explorer lists just those); `"all"` keeps every dataset.
- `datasets.extra`: dataset ids to keep as well.

The workspace's Zoer catalogue keeps its review notes about every collection.
The boundary and location files in `public/` are always copied.
