import { copyFile, mkdir } from "node:fs/promises";

// Static hosts can load the Atlas directly as well as via the client entry.
// Vite's absolute, configurable base keeps chunks and snapshots at the same URL.
await copyFile("dist/index.html", "dist/404.html");
// Story maps live under the public site root and again under /dev/projects,
// where the Atlas also shows its Zoer workspace details.
const stories = ["northern-communities", "physician-supply", "research-pathways", "travel-and-time", "community-context", "research-resources", "workforce-context", "education-and-health", "facilities-and-investment"];
for (const path of ["dev/projects", "campus", ...stories, ...stories.map(id => `dev/projects/${id}`)]) {
  await mkdir(`dist/${path}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${path}/index.html`);
}
