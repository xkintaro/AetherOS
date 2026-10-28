export const ROOT_ID = "aether";
export const HOME_ID = ROOT_ID;
export const DESKTOP_ID = "desktop";
export const DOCUMENTS_ID = "documents";
export const DOWNLOADS_ID = "downloads";
const protectedIds = new Set([ROOT_ID, DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID]);
export type Position = { x: number; y: number };
export type VFile = {
  id: string;
  name: string;
  parent: string | null;
  kind: "folder" | "text";
  content: string;
  modified: number;
  trashed?: boolean;
  desktopPosition?: Position;
};
export type FileResult = { ok: true } | { ok: false; error: string };
const directory = (id: string, name: string, parent: string | null): VFile => ({
  id,
  name,
  parent,
  kind: "folder",
  content: "",
  modified: 0,
});
const coreFolders = [
  directory(ROOT_ID, "aether", null),
  directory(DESKTOP_ID, "desktop", ROOT_ID),
  directory(DOCUMENTS_ID, "documents", ROOT_ID),
  directory(DOWNLOADS_ID, "downloads", ROOT_ID),
];
export const initialFiles: VFile[] = [
  ...coreFolders,
  {
    id: "readme",
    name: "Guide.txt",
    parent: DOCUMENTS_ID,
    kind: "text",
    modified: 0,
    content:
      "AetherOS\n\naether/desktop is the desktop folder.\nDrag files and folders between locations, or use Ctrl+X and Ctrl+V.\nTerminal: help.\nExport your files in Settings > Storage & backup.\n",
  },
];
export function isProtected(id: string) {
  return protectedIds.has(id);
}
// File arrays are immutable in the store. Reuse their index across path/search lookups.
const indexes = new WeakMap<VFile[], Map<string, VFile>>();
function fileIndex(files: VFile[]) {
  let index = indexes.get(files);
  if (!index) {
    index = new Map(files.map((file) => [file.id, file]));
    indexes.set(files, index);
  }
  return index;
}
export function ancestors(files: VFile[], id: string): VFile[] {
  const result: VFile[] = [];
  const seen = new Set<string>();
  const index = fileIndex(files);
  let file = index.get(id);
  while (file && !seen.has(file.id)) {
    seen.add(file.id);
    result.push(file);
    file = file.parent === null ? undefined : index.get(file.parent);
  }
  return result.reverse();
}
export function isAvailable(files: VFile[], id: string): boolean {
  const chain = ancestors(files, id);
  return (
    chain.length > 0 &&
    chain[0].id === ROOT_ID &&
    chain.every((f) => !f.trashed)
  );
}
export function childrenOf(files: VFile[], parent: string) {
  if (!isAvailable(files, parent)) return [];
  return files
    .filter((f) => f.parent === parent && !f.trashed)
    .sort((a, b) =>
      a.kind === b.kind
        ? a.name.localeCompare(b.name)
        : a.kind === "folder"
          ? -1
          : 1,
    );
}
export function filePath(files: VFile[], id: string): string {
  const parts = ancestors(files, id).map((f) => f.name);
  return parts.length === 1 ? parts[0] + "/" : parts.join("/");
}
export function resolvePath(
  files: VFile[],
  cwd: string,
  path: string,
): VFile | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (/^[a-z]:/i.test(normalized)) return undefined;
  let start = cwd,
    remaining = normalized;
  if (/^\/?aether(\/|$)/i.test(normalized)) {
    start = ROOT_ID;
    remaining = normalized.replace(/^\/?aether\/?/i, "");
  } else if (normalized === "~" || normalized.startsWith("~/")) {
    start = ROOT_ID;
    remaining = normalized.slice(1);
  } else if (normalized.startsWith("/")) start = ROOT_ID;
  let current = files.find((f) => f.id === start);
  for (const part of remaining.split("/").filter(Boolean)) {
    if (
      !current ||
      current.kind !== "folder" ||
      !isAvailable(files, current.id)
    )
      return undefined;
    if (part === ".") continue;
    if (part === "..") {
      current = files.find((f) => f.id === current!.parent) ?? current;
      continue;
    }
    current = files.find(
      (f) =>
        f.parent === current!.id &&
        !f.trashed &&
        f.name.toLowerCase() === part.toLowerCase(),
    );
  }
  return current && isAvailable(files, current.id) ? current : undefined;
}
export function validName(name: string) {
  return (
    name.trim().length > 0 &&
    !/[\\/<>:"|?*\u0000-\u001f]/.test(name) &&
    !/[. ]$/.test(name) &&
    name !== "." &&
    name !== ".." &&
    name.length <= 120
  );
}
export function hasNameConflict(
  files: VFile[],
  parent: string | null,
  name: string,
  except?: string,
) {
  return files.some(
    (f) =>
      f.id !== except &&
      f.parent === parent &&
      !f.trashed &&
      f.name.toLowerCase() === name.toLowerCase(),
  );
}
export function nextAvailableName(
  files: VFile[],
  parent: string,
  base: string,
): string {
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base,
    extension = dot > 0 ? base.slice(dot) : "";
  let name = base,
    suffix = 2;
  while (hasNameConflict(files, parent, name)) {
    name = `${stem} (${suffix})${extension}`;
    suffix++;
  }
  return name;
}
export function moveError(
  files: VFile[],
  id: string,
  parent: string,
): string | null {
  const file = files.find((f) => f.id === id),
    target = files.find((f) => f.id === parent);
  if (!file || !isAvailable(files, id))
    return "The item is no longer available.";
  if (isProtected(id)) return "This system folder cannot be moved.";
  if (!target || target.kind !== "folder" || !isAvailable(files, parent))
    return "The destination folder is unavailable.";
  if (ancestors(files, parent).some((f) => f.id === id))
    return "A folder cannot be moved into itself or one of its subfolders.";
  if (hasNameConflict(files, parent, file.name, id))
    return "An item with this name already exists in the destination.";
  return null;
}
export function moveEntry(
  files: VFile[],
  id: string,
  parent: string,
  position?: Position,
): { files: VFile[]; result: FileResult } {
  const error = moveError(files, id, parent);
  if (error) return { files, result: { ok: false, error } };
  return {
    files: files.map((f) =>
      f.id === id
        ? {
            ...f,
            parent,
            modified: Date.now(),
            desktopPosition: parent === DESKTOP_ID ? position : undefined,
          }
        : f,
    ),
    result: { ok: true },
  };
}
/** Flatten legacy drive/user wrappers without changing user item IDs or contents. */
export function migrateFiles(files: VFile[]): VFile[] {
  if (files.some((file) => file.id === ROOT_ID))
    return restoreSystemFolders(files);
  const wrappers = new Set(["drive-c", "users", "home"]);
  const flattened = files
    .filter((file) => !wrappers.has(file.id))
    .map((file) =>
      file.parent && wrappers.has(file.parent)
        ? { ...file, parent: ROOT_ID }
        : file,
    );
  // Flattening can bring identically named user items into the same directory.
  const result: VFile[] = [];
  for (const file of flattened) {
    let name = file.name,
      suffix = 2;
    while (!file.trashed && hasNameConflict(result, file.parent, name)) {
      name = file.name + " (" + suffix + ")";
      suffix++;
    }
    result.push(name === file.name ? file : { ...file, name });
  }
  return restoreSystemFolders(result);
}
/** Repair folders moved by older releases without replacing any of their contents. */
function restoreSystemFolders(files: VFile[]): VFile[] {
  let result = files;
  for (const expected of coreFolders) {
    const existing = result.find((file) => file.id === expected.id);
    if (
      existing &&
      existing.parent === expected.parent &&
      existing.name === expected.name &&
      existing.kind === "folder" &&
      !existing.trashed &&
      !existing.desktopPosition
    )
      continue;
    const conflict = result.find(
      (file) =>
        file.id !== expected.id &&
        file.parent === expected.parent &&
        !file.trashed &&
        file.name.toLowerCase() === expected.name.toLowerCase(),
    );
    if (conflict) {
      let suffix = 2;
      let name = `${conflict.name} (${suffix})`;
      while (hasNameConflict(result, conflict.parent, name)) {
        suffix++;
        name = `${conflict.name} (${suffix})`;
      }
      result = result.map((file) =>
        file.id === conflict.id ? { ...file, name } : file,
      );
    }
    if (existing)
      result = result.map((file) =>
        file.id === expected.id
          ? {
              ...file,
              name: expected.name,
              parent: expected.parent,
              kind: "folder",
              trashed: false,
              desktopPosition: undefined,
            }
          : file,
      );
    else result = [...result, { ...expected }];
  }
  return result;
}
export function parseBackup(data: unknown): VFile[] | null {
  if (
    !data ||
    typeof data !== "object" ||
    !("version" in data) ||
    ![1, 2, 3].includes(data.version as number) ||
    !("files" in data) ||
    !Array.isArray(data.files) ||
    data.files.length > 10000
  )
    return null;
  const files = data.files as VFile[];
  const rootId =
    data.version === 1 ? "home" : data.version === 2 ? "drive-c" : ROOT_ID;
  if (
    !files.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        f.id.length > 0 &&
        typeof f.name === "string" &&
        f.name.length > 0 &&
        !/[\\/\u0000-\u001f]/.test(f.name) &&
        typeof f.content === "string" &&
        Number.isFinite(f.modified) &&
        ["folder", "text"].includes(f.kind) &&
        (f.parent === null || typeof f.parent === "string") &&
        (f.trashed === undefined || typeof f.trashed === "boolean") &&
        (f.desktopPosition === undefined ||
          (f.desktopPosition !== null &&
            typeof f.desktopPosition === "object" &&
            Number.isFinite(f.desktopPosition.x) &&
            Number.isFinite(f.desktopPosition.y) &&
            f.desktopPosition.x >= 0 &&
            f.desktopPosition.y >= 0)),
    )
  )
    return null;
  if (new Set(files.map((f) => f.id)).size !== files.length) return null;
  const map = new Map(files.map((f) => [f.id, f]));
  const root = map.get(rootId);
  if (!root || root.parent !== null || root.kind !== "folder" || root.trashed)
    return null;
  // Each edge is checked once, including deeply nested backups.
  const connected = new Set([rootId]);
  for (const file of files) {
    const seen = new Set<string>();
    let node: VFile | undefined = file;
    while (!connected.has(node.id)) {
      if (seen.has(node.id) || node.parent === null) return null;
      seen.add(node.id);
      node = map.get(node.parent);
      if (!node || node.kind !== "folder") return null;
    }
    for (const id of seen) connected.add(id);
  }
  const migrated = migrateFiles(
    files.map((file) => ({
      id: file.id,
      name: file.name,
      parent: file.parent,
      kind: file.kind,
      content: file.content,
      modified: file.modified,
      ...(file.trashed !== undefined ? { trashed: file.trashed } : {}),
      ...(file.desktopPosition
        ? { desktopPosition: { ...file.desktopPosition } }
        : {}),
    })),
  );
  const siblingNames = new Map<string | null, Set<string>>();
  for (const file of migrated) {
    if (!validName(file.name)) return null;
    if (file.trashed) continue;
    const names = siblingNames.get(file.parent) ?? new Set<string>();
    const name = file.name.toLowerCase();
    if (names.has(name)) return null;
    names.add(name);
    siblingNames.set(file.parent, names);
  }
  for (const id of [ROOT_ID, DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID]) {
    const folder = migrated.find((f) => f.id === id);
    if (!folder || folder.kind !== "folder" || !isAvailable(migrated, id))
      return null;
  }
  for (const expected of coreFolders) {
    const actual = migrated.find((file) => file.id === expected.id);
    if (actual?.parent !== expected.parent) return null;
  }
  if (migrated.find((f) => f.id === ROOT_ID)?.name !== "aether") return null;
  return migrated;
}
