// Uses the same renderer, department lockup, and font embedding as nals-wp/showcase/logo.mjs.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderLogoSvg } from "../packages/unbc-logo/src/logo/renderLogoSvg.js";
import { BRAND_FONT_FAMILY } from "../packages/unbc-logo/src/export/fontEmbed.js";

const font = await readFile(
  new URL(
    "../packages/unbc-logo/fonts/HelveticaNeueLTPro-Black.otf",
    import.meta.url,
  ),
);
const fontCss = `@font-face{font-family:'${BRAND_FONT_FAMILY}';src:url(data:font/otf;base64,${font.toString("base64")}) format('opentype');font-weight:900;font-style:normal;}`;
const output = new URL("../public/brand/", import.meta.url);
await mkdir(output, { recursive: true });
for (const color of ["white", "green"]) {
  await writeFile(
    new URL(`nals-logo-${color}.svg`, output),
    renderLogoSvg({
      departmentText: "Northern Analytical Laboratory Services",
      color,
      fontCss,
      title: "Northern Analytical Laboratory Services, UNBC",
    }),
  );
}
