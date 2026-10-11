// Uses the same renderer, department lockup, and font embedding as nals-wp/showcase/logo.mjs.
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
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

// Pull the theme's web fonts from the NALS 1.0.1 source snapshot on every build.
const fonts = new URL("../public/fonts/", import.meta.url);
await mkdir(fonts, { recursive: true });
for (const name of [
  "BCSans-Regular.woff2",
  "BCSans-Bold.woff2",
  "BCSans-Light.woff2",
  "HelveticaNeueBlack.otf",
  "bcsans-regular.woff",
  "bcsans-bold.woff",
  "bcsans-light.woff",
  "helvetica-black.woff",
]) {
  await copyFile(
    new URL(`../vendor/nals-theme/assets/fonts/${name}`, import.meta.url),
    new URL(name, fonts),
  );
}
