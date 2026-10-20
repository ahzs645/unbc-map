/// <reference types="vite/client" />

/**
 * Build switches from manifest/ (see manifest/README.md). Vite replaces each
 * `FLAGS.x.y` with a literal at build time, so read leaf values directly; a
 * branch behind a false flag is dropped from the bundle.
 */
declare const FLAGS: {
  projects: { atlas: boolean; workspace: boolean; campus: boolean };
  locked: { atlas: boolean; workspace: boolean; campus: boolean };
  passwordHash: string;
  rememberHours: number;
  pages: { home: boolean; explore: boolean; sources: boolean };
  stories: { storyCardMeta: boolean; storyMapCardMeta: boolean; storyByline: boolean; storyScopeNote: boolean; storyMapValues: boolean };
  explore: { filters: boolean; chart: boolean; map: boolean; pairedMaps: boolean; datasetDetails: boolean; mapIcons: boolean };
  site: { statusBadges: boolean; campusLinks: boolean; sourcesInMenu: boolean };
};
