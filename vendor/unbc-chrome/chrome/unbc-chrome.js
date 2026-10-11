/**
 * UNBC Chrome behaviour: the search overlay, the phone menu, scroll to top,
 * cookie settings and the copyright year. No dependencies; load it once,
 * anywhere (it waits for the DOM). Markup comes from chrome/render.mjs or
 * inc/chrome-render.php.
 *
 * The overlay and the menu are exclusive (opening one closes the other), and
 * Escape closes whichever is open and returns focus to its button (unless a
 * modal dialog is open, which gets the Escape instead).
 *
 * Hooks for apps (see chrome/README.md):
 *   'unbc-chrome:search'  fired on the header (bubbles, cancelable) when the
 *                         search form is submitted; detail.query is the text.
 *                         preventDefault() keeps the browser on the page.
 *   'unbc-chrome:toggle'  fired on the header when the overlay or menu opens
 *                         or closes; detail = { part: 'search'|'menu', open }.
 *   window.UNBCChrome     { init, openSearch, closeSearch, closeMenu }
 */
(function () {
	'use strict';

	var MOBILE = window.matchMedia('(max-width: 767.98px)');

	function each(selector, fn) {
		Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
	}

	function notify(root, part, open) {
		root.dispatchEvent(new CustomEvent('unbc-chrome:toggle', { bubbles: true, detail: { part: part, open: open } }));
	}

	// A modal dialog over the page owns Escape.
	function escapeIsOurs(event) {
		return event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]');
	}

	function setSearch(root, open) {
		var search = root.querySelector('[data-unbc-search]');
		var toggle = root.querySelector('[data-unbc-search-toggle]');
		if (!search || !toggle) return;

		var changed = search.classList.contains('is-open') !== open;
		search.classList.toggle('is-open', open);
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		if (changed) notify(root, 'search', open);

		if (open) {
			setMenu(root, false);
			var input = search.querySelector('.unbc-search__input');
			// Focus after the panel becomes visible, or the browser ignores it.
			if (input) window.setTimeout(function () { input.focus(); }, 30);
		}
	}

	function setMenu(root, open) {
		var toggle = root.querySelector('[data-unbc-menu-toggle]');
		if (!toggle) return;

		var changed = root.classList.contains('is-menu-open') !== open;
		root.classList.toggle('is-menu-open', open);
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		document.documentElement.classList.toggle('unbc-menu-open', open && MOBILE.matches);
		if (changed) notify(root, 'menu', open);

		if (open) setSearch(root, false);
	}

	function initHeader(root) {
		var searchToggle = root.querySelector('[data-unbc-search-toggle]');
		var menuToggle = root.querySelector('[data-unbc-menu-toggle]');

		if (searchToggle) {
			searchToggle.addEventListener('click', function () {
				setSearch(root, searchToggle.getAttribute('aria-expanded') !== 'true');
			});
		}

		if (menuToggle) {
			menuToggle.addEventListener('click', function () {
				setMenu(root, menuToggle.getAttribute('aria-expanded') !== 'true');
			});
		}

		var form = root.querySelector('.unbc-search__form');
		if (form) {
			form.addEventListener('submit', function (event) {
				var input = form.querySelector('.unbc-search__input');
				var custom = new CustomEvent('unbc-chrome:search', {
					bubbles: true,
					cancelable: true,
					detail: { query: input ? input.value.trim() : '' }
				});
				if (!root.dispatchEvent(custom)) event.preventDefault();
			});
		}

		root.addEventListener('keydown', function (event) {
			if (!escapeIsOurs(event)) return;

			if (searchToggle && searchToggle.getAttribute('aria-expanded') === 'true') {
				setSearch(root, false);
				searchToggle.focus();
			} else if (menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
				setMenu(root, false);
				menuToggle.focus();
			}
		});

		document.addEventListener('keydown', function (event) {
			if (escapeIsOurs(event) && root.classList.contains('is-menu-open')) {
				setMenu(root, false);
				if (menuToggle) menuToggle.focus();
			}
		});

		// Leaving the phone layout with the menu open must not leave the page locked.
		var onChange = function () {
			if (!MOBILE.matches) setMenu(root, false);
		};
		if (MOBILE.addEventListener) MOBILE.addEventListener('change', onChange);
		else if (MOBILE.addListener) MOBILE.addListener(onChange);
	}

	function initFooter(root) {
		var top = root.querySelector('[data-unbc-scroll-top]');
		if (top) {
			var update = function () {
				top.classList.toggle('is-active', (window.pageYOffset || document.documentElement.scrollTop) > 240);
			};
			window.addEventListener('scroll', update, { passive: true });
			update();
			top.addEventListener('click', function (event) {
				event.preventDefault();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});
		}

		// UNBC's consent manager is Osano; without it, show the cookie notice.
		var cookie = root.querySelector('[data-unbc-cookie-settings]');
		if (cookie) {
			cookie.addEventListener('click', function () {
				if (window.Osano && window.Osano.cm && typeof window.Osano.cm.showDrawer === 'function') {
					window.Osano.cm.showDrawer('osano-cm-dom-info-dialog-open');
				} else if (cookie.getAttribute('data-fallback-url')) {
					window.location.href = cookie.getAttribute('data-fallback-url');
				}
			});
		}

		var year = root.querySelector('[data-unbc-year]');
		if (year) year.textContent = String(new Date().getFullYear());
	}

	function init() {
		each('.unbc-chrome--header', function (root) {
			if (root.hasAttribute('data-unbc-ready')) return;
			root.setAttribute('data-unbc-ready', '');
			initHeader(root);
		});
		each('.unbc-chrome--footer', function (root) {
			if (root.hasAttribute('data-unbc-ready')) return;
			root.setAttribute('data-unbc-ready', '');
			initFooter(root);
		});
	}

	function headers() {
		return document.querySelectorAll('.unbc-chrome--header');
	}

	// For apps that render the chrome after load (e.g. a React effect) or
	// drive it from their own controls.
	window.UNBCChrome = {
		init: init,
		openSearch: function () { Array.prototype.forEach.call(headers(), function (root) { setSearch(root, true); }); },
		closeSearch: function () { Array.prototype.forEach.call(headers(), function (root) { setSearch(root, false); }); },
		closeMenu: function () { Array.prototype.forEach.call(headers(), function (root) { setMenu(root, false); }); }
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
