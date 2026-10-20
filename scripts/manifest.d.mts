export const manifestDir: string;
export const manifestFiles: string[];
export interface ResolvedManifest {
  all: boolean;
  flags: Record<string, unknown>;
  enabledStories: Set<string>;
  enabledStoryMaps: Set<string>;
  datasets: Set<string>;
}
export function resolveManifest(options?: { all?: boolean }): ResolvedManifest;
export function flagDefines(flags: Record<string, unknown>, prefix?: string): Record<string, string>;
export function stripContent(code: string, fileName: string, manifest: ResolvedManifest): string | undefined;
export function stripSnapshot(json: string, manifest: ResolvedManifest): string;
export function stripHome(json: string, manifest: ResolvedManifest): string;
export function builtStoryMaps(): string[];
