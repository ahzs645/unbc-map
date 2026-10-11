# NALS theme source snapshot

Subset of NALS WordPress theme 1.0.1 from nals-wp-main (1).zip, matching upstream commit 53c8c991153c464a9449254c5aa788fd17b4d474 (https://github.com/ahzs645/nals-wp).

The upstream repository is private. This snapshot includes only the theme styles, fonts and logo source assets used to adapt the campus explorer, so public GitHub Pages builds do not require private-repository credentials. WordPress runtime, site content, development documents and repository history are not included.

Theme author: Ahmad Jalil. Theme code: GPL v2 or later. See the root LICENSE. BC Sans: SIL OFL, see public/fonts/LICENSE_OFL.txt. Helvetica brand fonts and UNBC artwork retain their separate rights, as described in public/brand/SOURCES.md.

scripts/build-brand.mjs copies web fonts from this snapshot into public/fonts on each build. src/nals-theme.css adapts these source styles for the map. When syncing a newer theme, replace this subset from the matching release and review changes in the adapter.
