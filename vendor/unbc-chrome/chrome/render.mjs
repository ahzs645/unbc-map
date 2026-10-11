/**
 * UNBC Chrome — the www.unbc.ca header, footer and breadcrumbs as HTML strings.
 *
 * Framework-free: no DOM, no React, no bundler features beyond JSON imports,
 * so it runs in Node (a static-site build), in a Vite/Next app, or in a
 * browser module. inc/chrome.php renders the very same markup for WordPress;
 * chrome/test/render-parity.mjs holds the two to byte-identical output.
 *
 *   import { resolveConfig, renderHeader, renderFooter } from './chrome/render.mjs'
 *   import brand from './brand.json' with { type: 'json' }
 *
 *   const config = resolveConfig(brand)
 *   header.innerHTML = renderHeader(config, { currentPath: location.pathname })
 *   footer.innerHTML = renderFooter(config)
 *
 * Pair it with chrome/css/unbc-chrome.css and chrome/unbc-chrome.js.
 *
 * The lockup is drawn by the UNBC logo kit, so department lines wrap exactly
 * as the kit's generator and the door signs do. It is imported by its package
 * name: install it from the kit's checkout, e.g.
 *   "@ahzs645/unbc-logo": "file:vendor/unbc-logo"   (this repository)
 *   "@ahzs645/unbc-logo": "file:packages/unbc-logo" (unbc-map)
 */
import defaults from './defaults.json' with { type: 'json' };
import icons from './icons.json' with { type: 'json' };
import { renderLogoMarkup } from '@ahzs645/unbc-logo/core';

export { defaults };

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Layers site settings over the UNBC defaults. Objects merge key by key,
 * arrays and other values replace, and null or a missing key keeps the
 * value underneath. `false` switches a part off (e.g. `"cta": false`).
 */
export function resolveConfig(...layers) {
	const merge = (base, over) => {
		if (over === undefined || over === null) return base;
		if (!isObject(base) || !isObject(over)) return over;
		const out = { ...base };
		for (const [key, value] of Object.entries(over)) {
			if (key.startsWith('_') || key === '$schema') continue;
			out[key] = merge(base[key], value);
		}
		return out;
	};
	return layers.reduce(merge, merge({}, defaults));
}

export const esc = (value) => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/** A config URL made safe for href, with site-root paths prefixed by `base`. */
export function chromeUrl(value, base = '') {
	const url = String(value ?? '').trim();
	if (url === '') return '#';
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
	if (scheme && !SAFE_SCHEMES.includes(scheme[1].toLowerCase())) return '#';
	if (url.startsWith('/') && !url.startsWith('//')) return String(base).replace(/\/+$/, '') + url;
	return url;
}

/** Off-site: an absolute http(s) link to a host outside unbc.ca. */
export function isExternal(value) {
	const host = /^https?:\/\/([^/?#:]+)/i.exec(String(value ?? '').trim());
	if (!host) return false;
	const name = host[1].toLowerCase();
	return name !== 'unbc.ca' && !name.endsWith('.unbc.ca');
}

const normalizePath = (value) => {
	let path = String(value ?? '').split(/[?#]/)[0] || '/';
	if (!path.endsWith('/')) path += '/';
	return path;
};

/** 'page' for the current page, 'trail' for a section it sits in, '' otherwise. */
function linkState(value, current) {
	const url = String(value ?? '').trim();
	if (current === null || !url.startsWith('/') || url.startsWith('//')) return '';
	const path = normalizePath(url);
	if (path === current) return 'page';
	if (path !== '/' && current.startsWith(path)) return 'trail';
	return '';
}

export function icon(name) {
	const def = icons[name];
	if (!def || typeof def !== 'object') return '';
	return `<svg class="unbc-icon unbc-icon--${esc(name)}" viewBox="0 0 ${def.width} ${def.height}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${def.d}"/></svg>`;
}

const options = (opts = {}) => ({
	base: opts.base ?? '',
	currentPath: opts.currentPath === undefined || opts.currentPath === null ? null : normalizePath(opts.currentPath),
	skipLink: opts.skipLink ?? true,
	year: opts.year ?? new Date().getFullYear()
});

function link(item, className, o, { external = false, active = false } = {}) {
	const state = active ? linkState(item.url, o.currentPath) : '';
	const classes = className + (state === 'page' ? ' is-active' : state === 'trail' ? ' is-active-trail' : '');
	const ext = external && isExternal(item.url);
	return `<a class="${classes}" href="${esc(chromeUrl(item.url, o.base))}"${state === 'page' ? ' aria-current="page"' : ''}>` +
		esc(item.label) +
		(ext ? `<span class="unbc-sr-only"> (external link)</span>${icon('external')}` : '') +
		'</a>';
}

const list = (items, className, linkClass, o, linkOptions) => (Array.isArray(items) && items.length
	? `<ul class="${className}">` + items.map((item) => `<li>${link(item, linkClass, o, linkOptions)}</li>`).join('') + '</ul>'
	: '');

const lockupMarkup = (department) => renderLogoMarkup({ departmentText: String(department ?? ''), color: 'currentColor' });

/** Lines the lockup draws for a department (0 for the plain wordmark). */
export const logoLineCount = (department) => (lockupMarkup(department).match(/<text\b/g) || []).length;

/**
 * The UNBC wordmark lockup as an inline SVG link home. The viewBox is cropped
 * to the ink (wordmark top to the last department line) so CSS can place the
 * wordmark exactly where www.unbc.ca places it.
 */
export function renderLogo(config, context = 'header', opts = {}) {
	const o = options(opts);
	const department = String(config.logo?.department ?? '');
	const markup = lockupMarkup(department);
	const lines = (markup.match(/<text\b/g) || []).length;
	const height = lines ? (3906 + (lines - 1) * 1000) / 100 : 30.68;
	const label = `${config.logo?.label ?? ''} ${department.replace(/\s+/g, ' ')}`.trim();
	const inner = markup.replace(/\s(?:id|data-name)="[^"]*"/g, '');

	return `<a class="unbc-logo unbc-logo--${esc(context)}" href="${esc(chromeUrl(config.home, o.base))}" rel="home" aria-label="${esc(label)}" data-lines="${lines}">` +
		`<svg class="unbc-logo__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 15 178 ${height}" aria-hidden="true" focusable="false">${inner}</svg></a>`;
}

/**
 * Search overlay, utility bar (call to action + search toggle), masthead with
 * logo and main menu, desktop tabs, and the mobile menu.
 *
 * @param {object} config  resolveConfig() output; `menu` is the main menu.
 * @param {object} [opts]
 * @param {string} [opts.base]         Prefix for site-root links ('/x' → base + '/x').
 * @param {string} [opts.currentPath]  Current path, to mark the active menu item.
 * @param {boolean} [opts.skipLink]    Render the skip link (WordPress adds its own).
 */
export function renderHeader(config, opts = {}) {
	const o = options(opts);
	const c = config;
	const tabs = c.tabs === null || c.tabs === undefined ? (c.audience ? c.audience.links : []) : c.tabs || [];
	const mobileCta = c.mobileCta === null || c.mobileCta === undefined ? c.cta : c.mobileCta;
	const search = c.search || null;
	const out = [];

	if (o.skipLink && c.skipLink) {
		out.push(`<a class="unbc-skip-link" href="${esc(c.skipLink.target)}">${esc(c.skipLink.label)}</a>`);
	}

	out.push('<div class="unbc-search" data-unbc-search><div class="unbc-container unbc-search__inner">');
	out.push('<div class="unbc-utility">');
	if (c.cta) out.push(link(c.cta, 'unbc-utility__cta', o));
	if (search) {
		out.push(`<button class="unbc-search__toggle" type="button" aria-expanded="false" aria-controls="unbc-search-panel" aria-label="${esc(search.placeholder)}" data-unbc-search-toggle>` +
			`${icon('search')}<span class="unbc-search__toggle-state">${icon('chevron-up')}${icon('close')}</span></button>`);
	}
	out.push('</div>');
	if (search) {
		out.push('<div class="unbc-search__panel" id="unbc-search-panel">' +
			`<form class="unbc-search__form" role="search" method="get" action="${esc(chromeUrl(search.action, o.base))}">` +
			`<label class="unbc-sr-only" for="unbc-search-input">${esc(search.placeholder)}</label>` +
			`<input class="unbc-search__input" id="unbc-search-input" type="search" name="${esc(search.param)}" placeholder="${esc(search.placeholder)}" autocomplete="off">` +
			`<button class="unbc-search__submit" type="submit" aria-label="Submit search">${icon('search')}</button></form>`);
		if (Array.isArray(search.links) && search.links.length) {
			out.push('<nav class="unbc-search__links" aria-label="Quick links">' + list(search.links, 'unbc-search__list', 'unbc-search__link', o, { external: true }) + '</nav>');
		}
		out.push('</div>');
	}
	out.push('</div></div>');

	out.push('<header class="unbc-header">');
	out.push('<div class="unbc-header__top">' +
		`<button class="unbc-header__menu-toggle" type="button" aria-expanded="false" aria-controls="unbc-mobile-nav" aria-label="Menu" data-unbc-menu-toggle>${icon('menu')}${icon('close')}</button>` +
		renderLogo(c, 'header', opts) + '</div>');
	if (Array.isArray(c.menu) && c.menu.length) {
		out.push('<div class="unbc-header__bottom"><div class="unbc-container"><nav class="unbc-primary-nav" aria-label="Main">' +
			list(c.menu, 'unbc-primary-nav__list', 'unbc-primary-nav__link', o, { active: true }) + '</nav></div></div>');
	}

	out.push('<div class="unbc-mobile-nav" id="unbc-mobile-nav" data-unbc-mobile-nav>');
	if (Array.isArray(c.menu) && c.menu.length) {
		out.push('<nav class="unbc-mobile-nav__main" aria-label="Main">' + list(c.menu, 'unbc-mobile-nav__list', 'unbc-mobile-nav__link', o, { active: true }) + '</nav>');
	}
	if (c.audience && Array.isArray(c.audience.links) && c.audience.links.length) {
		out.push(`<nav class="unbc-mobile-nav__section" aria-label="${esc(c.audience.label)}"><p class="unbc-mobile-nav__heading">${esc(c.audience.label)}</p>` +
			list(c.audience.links, 'unbc-mobile-nav__sublist', 'unbc-mobile-nav__sublink', o) + '</nav>');
	}
	if (mobileCta) out.push('<div class="unbc-mobile-nav__cta">' + link(mobileCta, 'unbc-button unbc-button--gold', o) + '</div>');
	out.push('</div>');
	out.push('</header>');

	if (tabs.length) {
		const label = c.audience && c.audience.label ? c.audience.label : 'Information For';
		out.push(`<div class="unbc-subheader"><div class="unbc-container"><nav class="unbc-tabs" aria-label="${esc(label)}">` +
			list(tabs, 'unbc-tabs__list', 'unbc-tabs__link', o) + '</nav></div></div>');
	}

	return '<div class="unbc-chrome unbc-chrome--header">' + out.join('') + '</div>';
}

/**
 * Address, links, territory acknowledgement, footer menu, social links,
 * the green lockup, legal links, cookie settings and the copyright line.
 *
 * @param {object} config  resolveConfig() output.
 * @param {object} [opts]
 * @param {string} [opts.base]  Prefix for site-root links.
 * @param {number} [opts.year]  Copyright year (defaults to this year; the script keeps it current).
 */
export function renderFooter(config, opts = {}) {
	const o = options(opts);
	const f = config.footer || {};
	const s = config.subfooter || {};
	const out = ['<footer class="unbc-footer"><div class="unbc-container">'];

	if (f.address) {
		const a = f.address;
		const lines = Array.isArray(a.lines) ? a.lines : [];
		out.push('<div class="unbc-footer__address"><p>' + (a.name ? `<strong>${esc(a.name)}</strong>` : '') +
			lines.map((line, i) => (i || a.name ? '<br>' : '') + esc(line)).join('') + '</p>');
		if (a.phone) {
			const phone = a.tel ? `<a href="${esc(chromeUrl('tel:' + a.tel))}">${esc(a.phone)}</a>` : esc(a.phone);
			out.push('<p>' + (a.phoneLabel ? `<strong>${esc(a.phoneLabel)}</strong> ` : '') + phone + '</p>');
		}
		out.push('</div>');
	}
	if (Array.isArray(f.addressLinks) && f.addressLinks.length) {
		out.push('<nav class="unbc-footer__address-links" aria-label="Additional footer links">' + list(f.addressLinks, 'unbc-footer__address-list', 'unbc-footer__address-link', o) + '</nav>');
	}
	if (f.acknowledgement && f.acknowledgement.text) {
		const ack = f.acknowledgement;
		out.push(`<p class="unbc-footer__land"><em>${esc(ack.text)} </em>` +
			(ack.link ? `<a href="${esc(chromeUrl(ack.link.url, o.base))}">${esc(ack.link.label)}</a>.` : '') + '</p>');
	}
	if (Array.isArray(f.menu) && f.menu.length) {
		out.push('<nav class="unbc-footer__nav" aria-label="Footer">' + list(f.menu, 'unbc-footer__nav-list', 'unbc-footer__nav-link', o) + '</nav>');
	}
	if (Array.isArray(f.social) && f.social.length) {
		out.push('<nav class="unbc-footer__social" aria-label="Social media"><ul class="unbc-footer__social-list">' +
			f.social.map((item) => {
				const glyph = icon(item.network);
				return `<li><a class="unbc-social unbc-social--${esc(item.network)}" href="${esc(chromeUrl(item.url, o.base))}" target="_blank" rel="noopener noreferrer" aria-label="Follow us on ${esc(item.label)}">` +
					(glyph || `<span class="unbc-social__label">${esc(item.label)}</span>`) + '</a></li>';
			}).join('') + '</ul></nav>');
	}
	out.push('</div></footer>');

	out.push('<div class="unbc-subfooter"><div class="unbc-container"><div class="unbc-subfooter__row">');
	out.push(renderLogo(config, 'footer', opts));
	if (Array.isArray(s.menu) && s.menu.length) {
		out.push('<nav class="unbc-subfooter__nav" aria-label="Legal">' + list(s.menu, 'unbc-subfooter__list', 'unbc-subfooter__link', o) + '</nav>');
	}
	if (s.cookieSettings) {
		out.push(`<button class="unbc-button unbc-subfooter__cookie" type="button" data-unbc-cookie-settings data-fallback-url="${esc(chromeUrl(s.cookieSettings.fallbackUrl, o.base))}">${esc(s.cookieSettings.label)}</button>`);
	}
	out.push('</div>');
	if (s.copyright) {
		out.push(`<p class="unbc-subfooter__copyright">Copyright © <span data-unbc-year>${esc(o.year)}</span> ${esc(s.copyright)}</p>`);
	}
	out.push('</div></div>');

	if (config.scrollTop) {
		out.push(`<a class="unbc-scroll-top" href="#" aria-label="Scroll to top" data-unbc-scroll-top>${icon('caret-up')}</a>`);
	}

	return '<div class="unbc-chrome unbc-chrome--footer">' + out.join('') + '</div>';
}

/**
 * Breadcrumbs below the page title: Home › … › current page.
 *
 * @param {{label: string, url?: string}[]} trail  Ancestors then the current page (no Home).
 */
export function renderBreadcrumbs(trail, config, opts = {}) {
	const o = options(opts);
	const items = [{ label: config.breadcrumbs?.homeLabel ?? 'Home', url: config.home }, ...(Array.isArray(trail) ? trail : [])];
	return '<nav class="unbc-breadcrumb" aria-label="Breadcrumb"><ol class="unbc-breadcrumb__list">' +
		items.map((item, i) => (i === items.length - 1
			? `<li><span aria-current="page">${esc(item.label)}</span></li>`
			: `<li><a href="${esc(chromeUrl(item.url, o.base))}">${esc(item.label)}</a></li>`)).join('') +
		'</ol></nav>';
}
