import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

// GeoToolkit's pinned source imports MapLibre's former default export.
// MapLibre 6 uses named exports. Adapt imports in a disposable build copy;
// preserve the original public toolkit submodule and use the patched renderer.
const root = resolve(import.meta.dirname, "..");
const source = join(root, "packages/geo-toolkit");
const temporary = join(root, ".cache/toolkit-build");
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
for (const file of [
  "src",
  "scripts",
  "package.json",
  "tsconfig.json",
  "tailwind.config.js",
]) {
  await cp(join(source, file), join(temporary, file), { recursive: true });
}
async function adapt(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await adapt(file);
    else if (/\.tsx?$/.test(entry.name)) {
      const text = await readFile(file, "utf8");
      let next = text.replace(
        /import (type )?(\w+)(?:, (\{[^\n]+\}))? from 'maplibre-gl'/g,
        (_, type, name, named) =>
          `import ${type ?? ""}* as ${name} from 'maplibre-gl'${named ? `\nimport ${named} from 'maplibre-gl'` : ""}`,
      );
      // Version 6 narrows paint-property keys and expression tuple types.
      // These casts only adapt the existing typed layer contracts.
      if (entry.name === "heatmap.tsx")
        next = next.replace(
          "setPaintProperty(layerId, key,",
          "setPaintProperty(layerId, key as Parameters<MapLibreGL.Map['setPaintProperty']>[1],",
        );
      if (entry.name === "pmtiles-fill.tsx")
        next = next
          .replace(
            "'fill-opacity', fillOpacity)",
            "'fill-opacity', fillOpacity as never)",
          )
          .replace(
            "'line-width', lineWidth)",
            "'line-width', lineWidth as never)",
          );
      if (next !== text) await writeFile(file, next);
    }
  }
}
try {
  await adapt(join(temporary, "src"));
  const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: temporary,
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH}`,
    },
  });
  if (result.status !== 0)
    throw new Error("Toolkit compatibility build failed");
  await rm(join(source, "dist"), { recursive: true, force: true });
  await cp(join(temporary, "dist"), join(source, "dist"), { recursive: true });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
