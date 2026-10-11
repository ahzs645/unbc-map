// Types for chrome/render.mjs (UNBC Chrome). Settings are documented in
// chrome/brand.schema.json and chrome/README.md.

export interface ChromeLink {
	label: string;
	url: string;
}

export interface ChromeSocialLink extends ChromeLink {
	network: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'youtube' | 'tiktok' | 'bluesky' | 'threads' | 'flickr' | 'vimeo' | (string & {});
}

/** Site settings: any subset of the defaults; false switches a part off. */
export interface ChromeSettings {
	home?: string;
	logo?: { department?: string; label?: string };
	skipLink?: { label: string; target: string } | false | null;
	cta?: ChromeLink | false | null;
	mobileCta?: ChromeLink | false | null;
	menu?: ChromeLink[];
	audience?: { label?: string; links?: ChromeLink[] } | false | null;
	tabs?: ChromeLink[] | false | null;
	search?: { action?: string; param?: string; placeholder?: string; links?: ChromeLink[] } | false | null;
	footer?: {
		address?: { name?: string; lines?: string[]; phoneLabel?: string; phone?: string; tel?: string } | false;
		addressLinks?: ChromeLink[];
		acknowledgement?: { text: string; link?: ChromeLink } | false;
		menu?: ChromeLink[];
		social?: ChromeSocialLink[];
	};
	subfooter?: {
		menu?: ChromeLink[];
		cookieSettings?: { label: string; fallbackUrl?: string } | false;
		copyright?: string;
	};
	breadcrumbs?: { homeLabel?: string };
	scrollTop?: boolean;
	[key: string]: unknown;
}

/** resolveConfig() output: the defaults with every layer applied. */
export type ChromeConfig = ChromeSettings & { logo: { department: string; label: string } };

export interface ChromeRenderOptions {
	/** Prefix for site-root links: '/x' becomes base + '/x'. */
	base?: string;
	/** Current path, to mark the active main-menu item. */
	currentPath?: string | null;
	/** Render the skip link (default true). */
	skipLink?: boolean;
	/** Copyright year (default: this year). */
	year?: number;
}

export const defaults: ChromeConfig;
export function resolveConfig(...layers: Array<ChromeSettings | null | undefined>): ChromeConfig;
export function renderHeader(config: ChromeConfig, options?: ChromeRenderOptions): string;
export function renderFooter(config: ChromeConfig, options?: ChromeRenderOptions): string;
export function renderBreadcrumbs(trail: Array<{ label: string; url?: string }>, config: ChromeConfig, options?: ChromeRenderOptions): string;
export function renderLogo(config: ChromeConfig, context?: 'header' | 'footer' | (string & {}), options?: ChromeRenderOptions): string;
export function logoLineCount(department: string): number;
export function chromeUrl(value: string, base?: string): string;
export function isExternal(value: string): boolean;
export function icon(name: string): string;
export function esc(value: unknown): string;

declare global {
	interface Window {
		UNBCChrome?: {
			init(): void;
			openSearch(): void;
			closeSearch(): void;
			closeMenu(): void;
		};
	}
	interface HTMLElementEventMap {
		'unbc-chrome:search': CustomEvent<{ query: string }>;
		'unbc-chrome:toggle': CustomEvent<{ part: 'search' | 'menu'; open: boolean }>;
	}
}
