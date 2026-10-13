import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Atlas from "./atlas/Atlas";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
const CampusApp = lazy(() => import("./App"));
const atlas = /\/dev\/projects(?:\/|$)/.test(location.pathname);
if (!atlas) document.title = "UNBC Campus Explorer";
createRoot(document.getElementById("root")!).render(
  !atlas ? (
    <Suspense fallback={<p>Loading campus explorer…</p>}><CampusApp /></Suspense>
  ) : <Atlas />,
);
