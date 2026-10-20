import { useEffect, type RefObject } from "react";

/** Restore within the bounded reader; page and reader scroll independently. */
export default function useStoryChapterUrl(rootRef: RefObject<HTMLDivElement>, chapterIds: string[]) {
  const chapterKey = JSON.stringify(chapterIds);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ids: string[] = JSON.parse(chapterKey);
    const pathname = window.location.pathname;
    let restoring = "";
    let positionRequested: (() => void) | null = null;
    let frame = 0;
    let restoreFrame = 0;
    let disposed = false;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = root.dataset.activeChapter;
        if (!active || !ids.includes(active) || window.location.pathname !== pathname) return;
        if (restoring) {
          // Keep a requested fragment stable through asynchronous font and
          // reader layout changes. User input releases this anchor immediately.
          if (active !== restoring && positionRequested) {
            cancelAnimationFrame(restoreFrame);
            restoreFrame = requestAnimationFrame(() => positionRequested?.());
          }
          return;
        }
        const hash = root.scrollTop > 1 ? `#${encodeURIComponent(active)}` : "";
        if (window.location.hash !== hash) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
      });
    };
    const restore = () => {
      if (window.location.pathname !== pathname) return;
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id) { restoring = ids[0]; positionRequested = () => root.scrollTo({ top: 0, behavior: "instant" }); positionRequested(); update(); return; }
      if (!ids.includes(id)) return;
      const panel = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!panel) return;
      restoring = id;
      // Scrolling the section itself also moves outer ancestors on mobile and
      // can place it below the reading line. Position the reader first, then
      // calculate only its own scroll offset.
      const position = () => {
        root.scrollIntoView({ block: "start", behavior: "instant" });
        const media = root.querySelector<HTMLElement>(".editorial-immersive-media");
        const declared = parseFloat(getComputedStyle(root).getPropertyValue("--editorial-top"));
        const top = Number.isFinite(declared) ? declared : 56;
        const offset = top + (window.matchMedia("(max-width: 700px)").matches ? media?.clientHeight ?? 0 : 0) + 24;
        // A chapter never leaves part of the story cover above the navigation.
        const coverEnd = root.querySelector<HTMLElement>(".atlas-story-cover")?.offsetHeight ?? 0;
        root.scrollTo({ top: Math.max(coverEnd, root.scrollTop + panel.getBoundingClientRect().top - root.getBoundingClientRect().top - offset), behavior: "instant" });
        update();
      };
      positionRequested = position;
      position();
      // Fragment navigation can apply its own anchor offset after the event.
      // Reconcile once after that browser frame, retaining the requested ID.
      cancelAnimationFrame(restoreFrame);
      restoreFrame = requestAnimationFrame(() => { restoring = id; position(); });
      // Web fonts can change preceding chapter heights after the first paint.
      // Restore that same requested chapter once its text layout is final.
      void document.fonts.ready.then(() => {
        if (!disposed && restoring === id && root.isConnected && window.location.hash === `#${encodeURIComponent(id)}`) {
          restoring = id; position();
        }
      });
    };
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-active-chapter"] });
    const layoutObserver = new ResizeObserver(() => {
      if (!restoring || !positionRequested) return;
      cancelAnimationFrame(restoreFrame);
      restoreFrame = requestAnimationFrame(() => positionRequested?.());
    });
    layoutObserver.observe(root);
    root.querySelectorAll('.editorial-slide').forEach(panel => layoutObserver.observe(panel));
    const releaseAnchor = () => { restoring = ""; positionRequested = null; cancelAnimationFrame(restoreFrame); };
    const inputEvents = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    inputEvents.forEach(event => window.addEventListener(event, releaseAnchor, { capture: true, passive: true }));
    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    restore();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame); cancelAnimationFrame(restoreFrame); observer.disconnect(); layoutObserver.disconnect();
      inputEvents.forEach(event => window.removeEventListener(event, releaseAnchor, true));
      root.removeEventListener("scroll", update);
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [rootRef, chapterKey]);
}
