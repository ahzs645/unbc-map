import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolveManifest } from "./manifest.mjs";

// Static hosts can load the Atlas directly as well as via the client entry.
// Vite's absolute, configurable base keeps chunks and snapshots at the same URL.
await copyFile("dist/index.html", "dist/404.html");
// Entry pages follow manifest/: story maps live under the public site root and
// again under /dev/projects, where the Atlas also shows its Zoer workspace
// details. Switched-off projects and stories get no page of their own.
const { all, flags, enabledStoryMaps, scanned } = resolveManifest();
const stories = [...enabledStoryMaps];
const paths = [
  ...(flags.projects.atlas ? [...(flags.pages.home ? ["stories"] : []), ...stories] : []),
  ...(flags.projects.workspace ? ["dev/projects", ...stories.map(id => `dev/projects/${id}`)] : []),
  ...(flags.projects.campus ? ["campus"] : []),
];
const shell = await readFile("dist/index.html", "utf8");
const attribute = text => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// A shared link is read without running the app, so each story's entry page
// has to name that story itself.
function entryPage(path) {
  const text = scanned.storyMapText.get(path.split("/").pop());
  if (!text) return shell;
  const title = attribute(`${text.title} · NHHR Atlas`);
  const summary = attribute(text.summary);
  return shell
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"/g, `$1${summary}"`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"/g, `$1${title}"`);
}
for (const path of paths) {
  await mkdir(`dist/${path}`, { recursive: true });
  await writeFile(`dist/${path}/index.html`, entryPage(path));
}

// public/ is copied whole, but a switched-off page or story must not stay
// downloadable. The maps fetch boundary, location and route files by name
// (some built at run time), so those stay; the Sources page links the rest.
const fetchedByMaps = /^(?:boundaries-|locations-|travel-route-connections)/;
if (!all && !flags.pages.sources) {
  for (const name of await readdir("dist/data/nhhr")) {
    if (!fetchedByMaps.test(name)) await rm(`dist/data/nhhr/${name}`);
  }
}
