import { copyFile, mkdir } from "node:fs/promises";
import { resolveManifest } from "./manifest.mjs";

// Static hosts can load the Atlas directly as well as via the client entry.
// Vite's absolute, configurable base keeps chunks and snapshots at the same URL.
await copyFile("dist/index.html", "dist/404.html");
// Entry pages follow manifest/: story maps live under the public site root and
// again under /dev/projects, where the Atlas also shows its Zoer workspace
// details. Switched-off projects and stories get no page of their own.
const { flags, enabledStoryMaps } = resolveManifest();
const stories = [...enabledStoryMaps];
const paths = [
  ...(flags.projects.atlas ? [...(flags.pages.home ? ["stories"] : []), ...stories] : []),
  ...(flags.projects.workspace ? ["dev/projects", ...stories.map(id => `dev/projects/${id}`)] : []),
  ...(flags.projects.campus ? ["campus"] : []),
];
for (const path of paths) {
  await mkdir(`dist/${path}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${path}/index.html`);
}
