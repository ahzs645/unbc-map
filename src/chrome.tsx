/**
 * The UNBC header, footer and breadcrumbs, from UNBC Chrome
 * (vendor/unbc-chrome, exported from nals-wp). The markup is the chrome's
 * own; this file only plugs the map into it:
 *
 * - the header search lists matching campus places as you type, and
 *   submitting selects the first one, instead of searching unbc.ca;
 * - "Campus map" (the map's own address) resets the map in place;
 * - links to #about open the map notes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import {
  chromeUrl,
  renderBreadcrumbs,
  renderFooter,
  renderHeader,
  resolveConfig,
} from "../vendor/unbc-chrome/chrome/render.mjs";
import "../vendor/unbc-chrome/chrome/css/unbc-chrome.css";
import "../vendor/unbc-chrome/chrome/unbc-chrome.js";
import brand from "../brand.json";
import { places, type Place } from "./data";

export const chromeConfig = resolveConfig(brand);
const base = import.meta.env.BASE_URL;
const home = new URL(base, location.href).href;

export interface ChromeActions {
  onHome: () => void;
  onAbout: () => void;
  /** Handles a click on another chrome link in place; true if it did. */
  onLink?: (link: HTMLAnchorElement) => boolean;
}

export interface ChromeSearchItem {
  id: string;
  name: string;
  searchText?: string;
}

export interface ChromeSearch {
  label: string;
  items: ChromeSearchItem[];
  onSelect: (item: ChromeSearchItem) => void;
}

/** Catches clicks on the chrome's links that belong to the map. */
function useMapLinks(
  ref: React.RefObject<HTMLDivElement | null>,
  { onHome, onAbout, onLink }: ChromeActions,
) {
  const actions = useRef({ onHome, onAbout, onLink });
  actions.current = { onHome, onAbout, onLink };
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (link.getAttribute("href") === "#about") {
        event.preventDefault();
        actions.current.onAbout();
      } else if (link.href === home) {
        event.preventDefault();
        window.UNBCChrome?.closeMenu();
        actions.current.onHome();
      } else if (actions.current.onLink?.(link)) {
        event.preventDefault();
        window.UNBCChrome?.closeMenu();
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [ref]);
}

const matchesFor = (term: string) => {
  const query = term.trim().toLowerCase();
  if (!query) return [];
  return places.filter((place) =>
    `${place.name} ${place.short} ${place.number}`.toLowerCase().includes(query),
  );
};

export function ChromeHeader({
  onHome,
  onAbout,
  onLink,
  onSelectPlace,
  search,
  site,
  activeUrl,
}: ChromeActions & {
  onSelectPlace?: (place: Place) => void;
  search?: ChromeSearch;
  /** brand.json settings this page replaces, such as its own menu. */
  site?: Partial<typeof brand>;
  /** The menu URL to mark as the current page, when the path alone is ambiguous. */
  activeUrl?: string;
}) {
  const config = useMemo(() => search ? resolveConfig({
    ...brand,
    ...site,
    search: { ...brand.search, placeholder: search.label },
  }) : chromeConfig, [search?.label, site]);
  const html = useMemo(
    () => renderHeader(config, { base, currentPath: activeUrl === undefined ? (search ? "/dev/projects" : "/") : null }),
    [config, activeUrl === undefined],
  );
  const ref = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [term, setTerm] = useState("");
  const select = useRef(onSelectPlace);
  select.current = onSelectPlace;
  const searchRef = useRef(search);
  searchRef.current = search;
  const matches = (query: string): ChromeSearchItem[] => searchRef.current
    ? searchRef.current.items.filter(item => `${item.name} ${item.searchText ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : matchesFor(query);
  useMapLinks(ref, { onHome, onAbout, onLink });

  // Several menu items can share one path and differ only by query, so the
  // page names its current item rather than leaving it to the path.
  useEffect(() => {
    if (activeUrl === undefined) return;
    const current = chromeUrl(activeUrl, base);
    ref.current
      ?.querySelectorAll<HTMLAnchorElement>(".unbc-primary-nav__link, .unbc-mobile-nav__link")
      .forEach((link) => {
        const active = link.getAttribute("href") === current;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
  }, [html, activeUrl]);

  useEffect(() => {
    window.UNBCChrome?.init();
    const root = ref.current!;
    const form = root.querySelector<HTMLFormElement>(".unbc-search__form")!;
    const input = root.querySelector<HTMLInputElement>(".unbc-search__input")!;
    // Live results sit between the search box and the quick links.
    const results = document.createElement("div");
    results.className = "campus-search-results";
    form.after(results);
    setSlot(results);

    const onInput = () => setTerm(input.value);
    const onSearch = (event: CustomEvent<{ query: string }>) => {
      event.preventDefault();
      const first = matches(event.detail.query)[0];
      if (first) choose(first);
    };
    const onToggle = (event: CustomEvent<{ part: string; open: boolean }>) => {
      if (event.detail.part === "search" && !event.detail.open) {
        input.value = "";
        setTerm("");
      }
    };
    input.addEventListener("input", onInput);
    root.addEventListener("unbc-chrome:search", onSearch as EventListener);
    root.addEventListener("unbc-chrome:toggle", onToggle as EventListener);
    return () => {
      input.removeEventListener("input", onInput);
      root.removeEventListener("unbc-chrome:search", onSearch as EventListener);
      root.removeEventListener("unbc-chrome:toggle", onToggle as EventListener);
      results.remove();
    };
  }, [html]);

  function choose(item: ChromeSearchItem) {
    window.UNBCChrome?.closeSearch();
    window.UNBCChrome?.closeMenu();
    if (searchRef.current) searchRef.current.onSelect(item);
    else {
      const place = places.find(place => place.id === item.id);
      if (place) select.current?.(place);
    }
  }

  const results = term.trim() ? matches(term) : [];
  return (
    <>
      <div
        ref={ref}
        className="chrome-slot"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {slot &&
        term.trim() !== "" &&
        createPortal(
          <div role="group" aria-label={search ? "NHHR datasets" : "Campus places"}>
            {results.slice(0, 8).map((place) => (
              <button key={place.id} type="button" onClick={() => choose(place)}>
                <span>{place.name}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            {results.length === 0 && (
              <p>{search ? "No datasets match. Try a research topic or dataset name." : "No campus places match. Try a building name or number."}</p>
            )}
          </div>,
          slot,
        )}
    </>
  );
}

export function ChromeFooter(actions: ChromeActions) {
  const html = useMemo(() => renderFooter(chromeConfig, { base }), []);
  const ref = useRef<HTMLDivElement>(null);
  useMapLinks(ref, actions);
  useEffect(() => window.UNBCChrome?.init(), []);
  return (
    <div
      ref={ref}
      className="chrome-slot"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * UNBC › Prince George campus › Campus Explorer, in the bar under the map's
 * header; or UNBC › NHHR Atlas › section, under an Atlas page title.
 */
export function ChromeBreadcrumbs({ section, className = "context-bar" }: { section?: string; className?: string } = {}) {
  const html = useMemo(
    () =>
      renderBreadcrumbs(
        section ? [{ label: "NHHR Atlas", url: "/dev/projects" }, { label: section }] : [
          {
            label: "Prince George campus",
            url: "https://www.unbc.ca/about-unbc/campus-location-details",
          },
          { label: "Campus Explorer" },
        ],
        { ...chromeConfig, home: "https://www.unbc.ca/", breadcrumbs: { homeLabel: "UNBC" } },
        { base },
      ),
    [section],
  );
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
