// Reads manifest/ and decides what a build contains. The Vite config turns the
// result into compile-time FLAGS and strips disabled stories, story maps and
// datasets from the sources, so switched-off content never reaches dist/.
//
// ATLAS_MANIFEST=all switches every project, page, option and story on and
// removes the passwords (local work and the full browser-test suite).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
export const manifestDir = `${root}manifest`;
export const manifestFiles = ["projects.json", "pages.json", "site.json", "content.json", "access.json", "home.json"].map(name => `${manifestDir}/${name}`);
const atlasDir = `${root}src/atlas`;
const snapshotDir = `${atlasDir}/snapshots`;

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const fail = message => { throw new Error(`manifest: ${message}`); };
function bool(value, where) {
  if (typeof value !== "boolean") fail(`${where} must be true or false`);
  return value;
}
function exactKeys(object, keys, where) {
  for (const key of Object.keys(object ?? {})) if (!keys.includes(key)) fail(`unknown ${where} "${key}" (expected one of: ${keys.join(", ")})`);
  for (const key of keys) if (!(key in (object ?? {}))) fail(`${where} "${key}" is missing`);
}

/** Story and story-map definitions as written in the sources, with the datasets each one reads. */
export function scanContent() {
  const datasetIds = new Set();
  const stories = new Map();
  const storyMaps = new Map();
  for (const name of readdirSync(snapshotDir).filter(file => file.endsWith(".json"))) {
    const json = readJson(`${snapshotDir}/${name}`);
    for (const dataset of json.datasets ?? []) datasetIds.add(dataset.id);
  }
  for (const name of readdirSync(snapshotDir).filter(file => file.endsWith(".json"))) {
    for (const story of readJson(`${snapshotDir}/${name}`).stories ?? []) {
      stories.set(story.id, new Set(JSON.stringify(story).match(/"[^"]+"/g).map(text => text.slice(1, -1)).filter(text => datasetIds.has(text))));
    }
  }
  const files = readdirSync(atlasDir).filter(file => file.endsWith(".ts")).map(file => ts.createSourceFile(file, readFileSync(`${atlasDir}/${file}`, "utf8"), ts.ScriptTarget.Latest, true));
  // Module-level declarations, so a story that spreads `researchFollowupChapters`
  // or reads a precomputed takeaway still counts the datasets behind them.
  const declarations = new Map();
  for (const file of files) for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer) declarations.set(declaration.name.text, [...(declarations.get(declaration.name.text) ?? []), declaration.initializer]);
    if (ts.isFunctionDeclaration(statement) && statement.name) declarations.set(statement.name.text, [...(declarations.get(statement.name.text) ?? []), statement]);
  }
  const datasetsOf = node => {
    const found = new Set();
    const seen = new Set();
    const visit = current => {
      if (ts.isStringLiteralLike(current) && datasetIds.has(current.text)) found.add(current.text);
      if (ts.isIdentifier(current) && !seen.has(current.text) && declarations.has(current.text)) { seen.add(current.text); declarations.get(current.text).forEach(visit); }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return found;
  };
  for (const file of files) {
    const visit = node => {
      const kind = contentKind(node);
      if (kind) (kind === "story" ? stories : storyMaps).set(propertyText(node, "id"), datasetsOf(node));
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return { datasetIds, stories, storyMaps };
}

function propertyText(object, name) {
  const property = object.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name);
  return property && ts.isStringLiteralLike(property.initializer) ? property.initializer.text : undefined;
}
/** A short story has id, datasetId and body; a story map has id and chapters. */
export function contentKind(node) {
  if (!ts.isObjectLiteralExpression(node) || !propertyText(node, "id")) return undefined;
  const names = new Set(node.properties.map(item => item.name?.getText()));
  if (names.has("chapters") && names.has("title")) return "storyMap";
  if (names.has("datasetId") && names.has("body")) return "story";
  return undefined;
}

/** home.json is page copy; placeholders are filled from the build in AtlasHome. */
function checkHome(home) {
  const placeholder = /\{([^}]*)\}/g;
  const text = (value, where, nullable = false) => {
    if (nullable && value === null) return;
    if (typeof value !== "string" || !value.trim()) fail(`home.${where} must be text${nullable ? " or null" : ""}`);
    for (const [, inner] of value.matchAll(placeholder)) {
      if (!/^(?:topics|(?:storyMaps|stories|datasets)(?::[^|{}]+\|[^|{}]+)?)$/.test(inner)) fail(`home.${where}: unknown placeholder {${inner}} (use {topics}, or {storyMaps}, {stories}, {datasets}, optionally as {stories:short story|short stories})`);
    }
  };
  const lines = (value, where) => { if (!Array.isArray(value) || !value.length) fail(`home.${where} must be a list of text`); value.forEach((item, index) => text(item, `${where}[${index}]`)); };
  exactKeys(home, ["eyebrow", "heading", "lead", "body", "primaryAction", "context", "destinations", "cards", "note"], "home field");
  text(home.eyebrow, "eyebrow"); lines(home.heading, "heading"); text(home.lead, "lead"); lines(home.body, "body"); text(home.primaryAction, "primaryAction");
  if (home.context !== null) { exactKeys(home.context, ["eyebrow", "heading", "body", "link"], "home.context field"); for (const key of ["eyebrow", "heading", "body", "link"]) text(home.context[key], `context.${key}`); }
  exactKeys(home.destinations, ["eyebrow", "heading"], "home.destinations field"); text(home.destinations.eyebrow, "destinations.eyebrow"); text(home.destinations.heading, "destinations.heading");
  exactKeys(home.cards, ["stories", "explore", "sources"], "home.cards entry");
  for (const [name, card] of Object.entries(home.cards)) { if (card === null) continue; exactKeys(card, ["title", "description", "detail", "action"], `home.cards.${name} field`); for (const key of ["title", "description", "detail", "action"]) text(card[key], `cards.${name}.${key}`); }
  text(home.note, "note", true);
}

let cached;
/** The resolved build: FLAGS values, enabled content ids and the datasets to keep. */
export function resolveManifest({ all = process.env.ATLAS_MANIFEST === "all" } = {}) {
  if (cached?.all === all) return cached.value;
  const projects = readJson(`${manifestDir}/projects.json`);
  const pages = readJson(`${manifestDir}/pages.json`);
  const site = readJson(`${manifestDir}/site.json`);
  const content = readJson(`${manifestDir}/content.json`);
  const access = readJson(`${manifestDir}/access.json`);
  checkHome(readJson(`${manifestDir}/home.json`));

  exactKeys(projects, ["atlas", "workspace", "campus"], "project");
  for (const [name, project] of Object.entries(projects)) { exactKeys(project, ["enabled", "password"], `projects.${name} field`); bool(project.enabled, `projects.${name}.enabled`); bool(project.password, `projects.${name}.password`); }
  exactKeys(pages, ["home", "stories", "explore", "sources"], "page");
  const pageOptions = { home: [], stories: ["storyCardMeta", "storyMapCardMeta", "storyByline", "storyScopeNote", "storyMapValues"], explore: ["filters", "chart", "map", "pairedMaps", "datasetDetails", "mapIcons"], sources: [] };
  for (const [name, page] of Object.entries(pages)) {
    bool(page.enabled, `pages.${name}.enabled`);
    exactKeys(page.options ?? {}, pageOptions[name], `pages.${name} option`);
    for (const [option, value] of Object.entries(page.options ?? {})) bool(value, `pages.${name}.options.${option}`);
  }
  if (!pages.stories.enabled) fail("pages.stories.enabled must stay true: stories are the Atlas's landing content");
  exactKeys(site, ["statusBadges", "campusLinks", "sourcesInMenu"], "site option");
  for (const [option, value] of Object.entries(site)) bool(value, `site.${option}`);
  // Only the password's SHA-256 is kept, here and in the built site, so the
  // public repository never holds the password itself (npm run manifest:password).
  exactKeys(access, ["passwordSha256", "rememberHours"], "access field");
  if (typeof access.passwordSha256 !== "string" || !/^[0-9a-f]{64}$/.test(access.passwordSha256)) fail("access.passwordSha256 must be a SHA-256 hex digest; set it with npm run manifest:password -- <password>");
  if (typeof access.rememberHours !== "number" || !(access.rememberHours > 0)) fail("access.rememberHours must be a positive number of hours");

  const scanned = scanContent();
  const checkList = (listed, found, kind) => {
    for (const id of Object.keys(listed ?? {})) { if (!found.has(id)) fail(`${kind} "${id}" is listed in content.json but does not exist in the sources`); bool(listed[id], `content.${kind}.${id}`); }
    const missing = [...found.keys()].filter(id => !(id in (listed ?? {})));
    if (missing.length) fail(`add these ${kind} to content.json as true or false: ${missing.join(", ")}`);
  };
  checkList(content.storyMaps, scanned.storyMaps, "storyMaps");
  checkList(content.stories, scanned.stories, "stories");
  if (!["stories", "all"].includes(content.datasets?.include)) fail('content.datasets.include must be "stories" or "all"');
  for (const id of content.datasets.extra ?? []) if (!scanned.datasetIds.has(id)) fail(`content.datasets.extra "${id}" is not a dataset id`);

  const on = value => all || value;
  const enabledStories = new Set([...scanned.stories.keys()].filter(id => on(content.stories[id])));
  const enabledStoryMaps = new Set([...scanned.storyMaps.keys()].filter(id => on(content.storyMaps[id])));
  const datasets = new Set(all || content.datasets.include === "all" ? scanned.datasetIds : [
    ...[...enabledStories].flatMap(id => [...scanned.stories.get(id)]),
    ...[...enabledStoryMaps].flatMap(id => [...scanned.storyMaps.get(id)]),
    ...(content.datasets.extra ?? []),
  ]);
  if (!datasets.size) fail("the build would contain no datasets; enable a story or add content.datasets.extra");

  const projectOn = name => on(projects[name].enabled);
  const flags = {
    projects: { atlas: projectOn("atlas"), workspace: projectOn("workspace"), campus: projectOn("campus") },
    locked: Object.fromEntries(["atlas", "workspace", "campus"].map(name => [name, !all && projects[name].password])),
    passwordHash: access.passwordSha256,
    rememberHours: access.rememberHours,
    pages: { home: on(pages.home.enabled), explore: on(pages.explore.enabled), sources: on(pages.sources.enabled) },
    stories: Object.fromEntries(pageOptions.stories.map(option => [option, on(pages.stories.options[option])])),
    explore: Object.fromEntries(pageOptions.explore.map(option => [option, on(pages.explore.options[option])])),
    site: Object.fromEntries(Object.entries(site).map(([option, value]) => [option, on(value)])),
  };
  if (!Object.values(flags.projects).some(Boolean)) fail("every project is disabled");
  const value = { all, flags, enabledStories, enabledStoryMaps, datasets, scanned };
  cached = { all, value };
  return value;
}

/** `FLAGS.a.b` → literal, for Vite's define, so disabled branches minify away. */
export function flagDefines(flags, prefix = "FLAGS") {
  return Object.fromEntries(Object.entries(flags).flatMap(([key, value]) => value && typeof value === "object" ? Object.entries(flagDefines(value, `${prefix}.${key}`)) : [[`${prefix}.${key}`, JSON.stringify(value)]]));
}

/** Removes disabled stories and story maps from a TypeScript module's array literals. */
export function stripContent(code, fileName, { enabledStories, enabledStoryMaps }) {
  const file = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = node => {
    if (ts.isArrayLiteralExpression(node)) {
      const keep = node.elements.filter(element => {
        const kind = contentKind(element);
        return !kind || (kind === "story" ? enabledStories : enabledStoryMaps).has(propertyText(element, "id"));
      });
      if (keep.length !== node.elements.length) {
        edits.push([node.elements.pos, node.elements.end, keep.map(element => element.getFullText()).join(",")]);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!edits.length) return undefined;
  return edits.sort((a, b) => b[0] - a[0]).reduce((text, [start, end, replacement]) => text.slice(0, start) + replacement + text.slice(end), code);
}

/** Keeps only the enabled stories and the build's datasets in a snapshot. */
export function stripSnapshot(json, { enabledStories, datasets }) {
  const data = JSON.parse(json);
  if (Array.isArray(data.datasets)) data.datasets = data.datasets.filter(dataset => datasets.has(dataset.id));
  if (Array.isArray(data.stories)) data.stories = data.stories.filter(story => enabledStories.has(story.id));
  return JSON.stringify(data);
}

/** Drops home.json copy for pages this build leaves out, so it is not bundled either. */
export function stripHome(json, { flags }) {
  const home = JSON.parse(json);
  if (!flags.pages.explore) home.cards.explore = null;
  if (!flags.pages.sources) { home.cards.sources = null; if (home.context) home.context.link = ""; }
  return JSON.stringify(home);
}

/** The story-map ids a static host needs entry pages for. */
export const builtStoryMaps = () => [...resolveManifest().enabledStoryMaps];
