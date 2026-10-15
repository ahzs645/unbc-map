import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Atlas from "./atlas/Atlas";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
const CampusApp = lazy(() => import("./App"));
// The site opens on the Atlas's research stories; the campus map lives at
// /campus. Old shared place links (/#place=…) still land on the map.
if (location.pathname.replace(/\/$/, "") === import.meta.env.BASE_URL.replace(/\/$/, "")) {
  const path = /(?:^#|&)place=/.test(location.hash) ? "campus" : "dev/projects";
  history.replaceState(history.state, "", `${import.meta.env.BASE_URL}${path}${location.search}${location.hash}`);
}
const atlas = /\/dev\/projects(?:\/|$)/.test(location.pathname);
if (!atlas) document.title = "UNBC Campus Explorer";
createRoot(document.getElementById("root")!).render(
  !atlas ? (
    <Suspense fallback={<p>Loading campus explorer…</p>}><CampusApp /></Suspense>
  ) : <Atlas />,
);
