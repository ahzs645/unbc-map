/**
 * The Atlas has two addresses. The site root is the public Atlas. Under
 * /dev/projects the same pages also show the Zoer workspace behind them:
 * collection IDs, source tables, catalogue listings and links into Zoer.
 */
const base = import.meta.env.BASE_URL;
const devHome = `${base}dev/projects`;

export const atlasDev = FLAGS.projects.workspace && (location.pathname === devHome || location.pathname.startsWith(`${devHome}/`));
/** The Atlas home page, as a path on this site. */
export const atlasHome = atlasDev ? devHome : base;
/** With the home page on, the public story catalogue has its own page; the workspace keeps its address. */
export const atlasStoriesHome = FLAGS.pages.home && !atlasDev ? `${base}stories` : atlasHome;
/** Prefix for story-map pages: `${atlasRoot}/<story>`. */
export const atlasRoot = atlasHome.replace(/\/$/, "");
/** The Atlas home as a site-relative chrome menu URL ("/" is the site base). */
export const atlasMenuHome = atlasDev ? "/dev/projects" : "/";
export type AtlasView = "home" | "stories" | "explore" | "sources";
export const atlasMenuUrl = (view: AtlasView = "stories") =>
  view === "stories" ? (atlasStoriesHome === atlasHome ? atlasMenuHome : "/stories")
  : view === "home" ? (atlasDev ? `${atlasMenuHome}?view=home` : atlasMenuHome)
  : `${atlasMenuHome}?view=${view}`;
export const atlasViewHref = (query = "") => `${atlasHome}${query}`;

export const isZoerUrl = (url: string | undefined) => !!url && /^https?:\/\/zoer\./i.test(url);

/** Public pages name the NHHR Data Space rather than the Zoer workspace. */
export const publicText = (text: string) => text.replace(/\bNHHR Zoer\b/g, "NHHR Data Space").replace(/\bZoer\b/g, "NHHR Data Space");

/** Rewrites Zoer wording in released copy, in place; IDs, keys and URLs are untouched. */
export function scrubZoer<T>(value: T): T {
  if (atlasDev) return value;
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") return item.includes("Zoer") ? publicText(item) : item;
    if (Array.isArray(item)) { for (let index = 0; index < item.length; index++) item[index] = visit(item[index]); return item; }
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) if (!/url$|Url$|Id$|Ids$|^id$/.test(key)) (item as Record<string, unknown>)[key] = visit(child);
    }
    return item;
  };
  return visit(value) as T;
}
