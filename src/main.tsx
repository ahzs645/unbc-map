import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Atlas from "./atlas/Atlas";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
const CampusApp = lazy(() => import("./App"));
// The public NHHR Atlas is the site's home page; /dev/projects is the same
// Atlas with its Zoer workspace details. The campus map lives at /campus, and
// old shared place links (/#place=…) still land on it.
const base = import.meta.env.BASE_URL;
const atRoot = location.pathname.replace(/\/$/, "") === base.replace(/\/$/, "");
if (atRoot && /(?:^#|&)place=/.test(location.hash)) history.replaceState(history.state, "", `${base}campus${location.search}${location.hash}`);
const atlas = location.pathname.replace(/\/$/, "") !== `${base}campus`;
if (!atlas) document.title = "UNBC Campus Explorer";
createRoot(document.getElementById("root")!).render(
  !atlas ? (
    <Suspense fallback={<p>Loading campus explorer…</p>}><CampusApp /></Suspense>
  ) : <Atlas />,
);
