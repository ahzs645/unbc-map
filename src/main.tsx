import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Atlas from "./atlas/Atlas";
import { PasswordGate, Unavailable } from "./access";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
// A switched-off campus project leaves its chunk out of the build.
const CampusApp = FLAGS.projects.campus ? lazy(() => import("./App")) : undefined;
// The public NHHR Atlas is the site's home page; /dev/projects is the same
// Atlas with its Zoer workspace details. The campus map lives at /campus, and
// old shared place links (/#place=…) still land on it. manifest/projects.json
// switches each of the three on or off and can put it behind the password.
const base = import.meta.env.BASE_URL;
const path = location.pathname.replace(/\/$/, "");
const atRoot = path === base.replace(/\/$/, "");
if (FLAGS.projects.campus && atRoot && /(?:^#|&)place=/.test(location.hash)) history.replaceState(history.state, "", `${base}campus${location.search}${location.hash}`);
const project = location.pathname.replace(/\/$/, "") === `${base}campus` ? "campus" : path === `${base}dev/projects` || path.startsWith(`${base}dev/projects/`) ? "workspace" : "atlas";
const enabled = project === "campus" ? FLAGS.projects.campus : project === "workspace" ? FLAGS.projects.workspace : FLAGS.projects.atlas;
const locked = project === "campus" ? FLAGS.locked.campus : project === "workspace" ? FLAGS.locked.workspace : FLAGS.locked.atlas;
if (project === "campus") document.title = "UNBC Campus Explorer";
const page = !enabled ? <Unavailable />
  : project === "campus" && CampusApp ? <Suspense fallback={<p>Loading campus explorer…</p>}><CampusApp /></Suspense>
  : <Atlas />;
createRoot(document.getElementById("root")!).render(
  locked && enabled ? <PasswordGate title={project === "campus" ? "UNBC Campus Explorer" : project === "workspace" ? "NHHR Atlas workspace" : "NHHR Atlas"}>{page}</PasswordGate> : page,
);
