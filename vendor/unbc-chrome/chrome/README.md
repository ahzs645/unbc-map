# UNBC Chrome

The www.unbc.ca header, footer and breadcrumbs as one reusable component, so every UNBC site
starts on brand. It draws the lockup with the [UNBC logo kit](https://github.com/ahzs645/unbc-logo)
(`vendor/unbc-logo`), so a department line breaks exactly as UNBC's official sub-logos do.

With **no settings at all** you get www.unbc.ca's own chrome: the wordmark, UNBC's menu, the
search overlay with its quick links, Apply to UNBC, the "Information For" tabs, the address and
territory acknowledgement, footer links, social links and legal links. A site changes only what is
its own, in one `brand.json`.

It runs in two places from the same settings and the same markup:

| | Markup | Styles | Behaviour |
| --- | --- | --- | --- |
| **WordPress** (this theme, or a child theme) | `inc/chrome-render.php` via the `unbc/header`, `unbc/footer` and `unbc/breadcrumbs` blocks | compiled into `assets/css/main.css` | `chrome/unbc-chrome.js` (enqueued) |
| **Anything else** (static, Vite, React, a build script) | `chrome/render.mjs` | `chrome/css/unbc-chrome.css` | `chrome/unbc-chrome.js` |

`npm test` renders 20 configurations through both renderers and fails unless the PHP and
JavaScript output are byte-identical, and holds the PHP port of the logo kit to the kit for every
department in the kit's wrap snapshot.

Live demos (no WordPress): `chrome/demo/index.html` (zero configuration) and
`chrome/demo/nals.html` (this repository's `brand.json`). Rebuild them with `npm run demo`.

---

## Settings: `brand.json`

`chrome/defaults.json` is www.unbc.ca as captured in October 2026. A site's `brand.json` is layered
on top:

- objects merge key by key, arrays replace, `null` keeps the default;
- `false` switches a part off (`"cta": false`, `"tabs": false`, `"search": false`);
- a URL starting with `/` is a page on the site and gets the site's address in front of it.

Smallest useful file, for a department site:

```json
{
  "$schema": "./chrome/brand.schema.json",
  "logo": { "department": "School of Engineering" },
  "menu": [
    { "label": "Programs", "url": "/programs/" },
    { "label": "Research", "url": "/research/" },
    { "label": "Contact", "url": "/contact/" }
  ],
  "footer": {
    "address": {
      "name": "School of Engineering",
      "lines": ["3333 University Way", "Prince George, B.C.  Canada  V2N 4Z9"],
      "phoneLabel": "Phone:", "phone": "250-960-5555", "tel": "+12509605555"
    }
  }
}
```

| Key | What it is | Default |
| --- | --- | --- |
| `logo.department` | Line under the wordmark. `\n` forces a break; empty for the plain wordmark. | `""` |
| `cta` | Gold button beside the search tab | Apply to UNBC |
| `mobileCta` | Gold button at the end of the phone menu | the `cta` |
| `menu` | Main menu | UNBC's seven items |
| `audience` | `{label, links}` under "Information For" in the phone menu | Future students … Donors |
| `tabs` | Warm tabs under the masthead (desktop) | the `audience` links |
| `search` | `{action, param, placeholder, links}` — the form and its quick links | unbc.ca search, 11 links |
| `footer.address` | `{name, lines, phoneLabel, phone, tel}` | UNBC Prince George |
| `footer.addressLinks` | Links under the address | UNBC campuses, Contact UNBC |
| `footer.acknowledgement` | `{text, link}` | UNBC's territory acknowledgement |
| `footer.menu` | Footer links, dot-separated | Contact UNBC … Emergency |
| `footer.social` | `{network, label, url}`; networks: facebook, instagram, linkedin, x, youtube, tiktok, bluesky, threads, flickr, vimeo | UNBC's five accounts |
| `subfooter.menu` | Legal links | Accessibility, Cookie notice, Privacy |
| `subfooter.cookieSettings` | `{label, fallbackUrl}`: opens Osano's drawer, or the cookie notice where Osano isn't loaded | Cookie Settings |
| `breadcrumbs.homeLabel` | First breadcrumb | Home |

`chrome/brand.schema.json` describes every key, so editors autocomplete and check the file.

---

## In WordPress

`parts/header.html` is `<!-- wp:unbc/header /-->` and `parts/footer.html` is
`<!-- wp:unbc/footer /-->`; page templates add `<!-- wp:unbc/breadcrumbs /-->` under the title.
The blocks render on the server, and the editor shows their output as a preview.

Settings are layered in this order, later winning:

1. `chrome/defaults.json` — www.unbc.ca
2. `brand.json` in this theme — NALS
3. `brand.json` in a **child theme** — your site
4. the site's **Navigation** (Site Editor → Navigation) — the main menu; links with the class
   `menu-info-link` become the "Information For" list (a link with the class
   `menu-section-title` names it), and a Buttons block becomes the phone menu's button
5. **Appearance → Customize → UNBC Branding** — the department line
6. the `unbc_chrome_config` filter

### A new site

Make a child theme with a `style.css` (`Template: nals`) and a `brand.json`. That is all:
the header, footer, fonts, search and menus come from this theme, and theme updates bring chrome
fixes with them.

```php
// Or adjust anything from a plugin or the child theme's functions.php:
add_filter( 'unbc_chrome_config', function ( $config ) {
	$config['cta'] = array( 'label' => 'Book a tour', 'url' => '/visit/' );
	return $config;
} );

// Pick a specific Navigation menu (default: the most recent one):
add_filter( 'unbc_chrome_navigation_id', fn() => 123 );

// Change the breadcrumb trail:
add_filter( 'unbc_chrome_breadcrumb_trail', function ( $trail ) { return $trail; } );
```

`[unbc_logo context="footer"]` draws the lockup in content (`[nals_unbc_logo]` still works).

---

## Outside WordPress

Either add this repository as a submodule (recursively, because the logo kit is a submodule of
it), or, for a public site whose CI cannot clone this private repository, export a copy:

```bash
npm run export:chrome -- ../my-site/vendor/unbc-chrome   # writes a self-contained snapshot + SOURCE.json
```

Either way the renderer imports the logo kit by package name, so the site installs it from its own
kit checkout: `"@ahzs645/unbc-logo": "file:packages/unbc-logo"`. Types are in
`chrome/render.d.mts`. unbc-map is the worked example (`vendor/unbc-chrome`, `npm run chrome:sync`).

Then render at build time or in the browser:

```js
import { resolveConfig, renderHeader, renderFooter, renderBreadcrumbs } from './vendor/unbc-chrome/chrome/render.mjs'
import './vendor/unbc-chrome/chrome/css/unbc-chrome.css'
import './vendor/unbc-chrome/chrome/unbc-chrome.js'
import brand from './brand.json' with { type: 'json' }

const config = resolveConfig(brand)
document.querySelector('#site-header').innerHTML = renderHeader(config, { currentPath: location.pathname })
document.querySelector('#site-footer').innerHTML = renderFooter(config)
window.UNBCChrome.init()
```

In React, render the strings with `dangerouslySetInnerHTML` (memoised, so React never replaces
them) and call `window.UNBCChrome.init()` in an effect.

Hooks for apps that do their own thing with the chrome:

- `unbc-chrome:search` fires on the header when the search form is submitted
  (`event.detail.query`); call `preventDefault()` to stay on the page and search your own data.
  The panel (`#unbc-search-panel`) is a stable node, so an app can portal live results into it.
- `unbc-chrome:toggle` fires when the overlay or phone menu opens or closes
  (`detail.part` is `search` or `menu`, `detail.open` a boolean).
- `window.UNBCChrome.openSearch()`, `closeSearch()` and `closeMenu()` drive them from your code.
- Menu links are plain links: give one a `#hash` URL and catch the click to open a dialog.
- Escape is left alone while a modal `<dialog>` is open. Give the page's `<main>` the id `main-content` for the skip link (or set
`skipLink.target`). `renderHeader` options: `base` (prefix for `/` links), `currentPath` (marks
the active menu item), `skipLink` (false to omit). The stylesheet's fonts resolve to this
repository's `assets/fonts/`; everything is scoped under `.unbc-chrome`, so host styles for bare
elements or Bootstrap-style class names do not reach it.

---

## Files

| Path | Role |
| --- | --- |
| `defaults.json` | www.unbc.ca's chrome content |
| `brand.schema.json` | Schema for a site's `brand.json` |
| `render.mjs` | JavaScript renderer (`render.d.mts`: its types) |
| `../inc/chrome-render.php` | PHP renderer (same markup) |
| `../inc/chrome-logo.php` | PHP port of the logo kit's wrapping and lockup |
| `../inc/chrome.php` | WordPress: settings, Navigation, blocks, breadcrumbs, Customizer |
| `editor.js` | Block editor previews for the three blocks |
| `unbc-chrome.js` | Search overlay, phone menu, scroll to top, cookie settings, year |
| `../src/scss/chrome/` | Styles, every value measured from www.unbc.ca (`!default`, overridable) |
| `css/unbc-chrome.css` | Standalone compiled styles (generated) |
| `icons.json` | Inline SVG icons, Font Awesome Free (CC BY 4.0) (generated) |
| `logo-kit.json` | Artwork and wrapping data from the logo kit (generated) |
| `scripts/` | `sync-logo`, `build-icons`, `build-css`, `build-demo`, `export` |
| `test/` | Logo and renderer parity tests |

## Keeping it current

```bash
npm install
git submodule update --remote vendor/unbc-logo   # new kit release
npm run sync:logo                                # copy its artwork, wrapping data and font
npm run build                                    # icons and stylesheets
npm run demo
npm test
```

`npm test` also fails when a generated file (logo data, font, stylesheets) is out of date with its
source. When UNBC changes its own header or footer, update `defaults.json` and the SCSS
settings; every site picks it up on the next theme release.
