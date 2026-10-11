#!/usr/bin/env node
/**
 * Refreshes vendor/unbc-chrome from a local nals-wp checkout. nals-wp is
 * private, so the public Pages build uses this committed snapshot instead of
 * a submodule.
 *
 *   npm run chrome:sync                      # nals-wp next to this repo
 *   NALS_WP=/path/to/nals-wp npm run chrome:sync
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nalsWp = path.resolve(process.env.NALS_WP || process.argv[2] || path.join(root, "../nals-wp"));
const exporter = path.join(nalsWp, "chrome/scripts/export.mjs");

if (!existsSync(exporter)) {
  console.error(`No nals-wp checkout with UNBC Chrome at ${nalsWp}. Set NALS_WP=/path/to/nals-wp.`);
  process.exit(1);
}
execFileSync(process.execPath, [exporter, path.join(root, "vendor/unbc-chrome")], { stdio: "inherit" });
