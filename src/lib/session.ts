import { restoreTheme } from "./theme";
import {
  initialFiles,
  parseBackup,
  ROOT_ID,
  isTextFileName,
  type VFile,
} from "./filesystem";
import {
  appIds,
  appNames,
  topWindowId,
  type AppId,
  type WindowState,
} from "./window-state";
import { windowMinimums } from "./window-geometry";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const choice = <T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T => (values.includes(value as T) ? (value as T) : fallback);

/** Whitelist persisted data; never merge stored action names into the live store. */
export function restoreSession(value: unknown) {
  const saved = record(value);
  let files: VFile[] = initialFiles;
  if (saved.files !== undefined) {
    const entries = Array.isArray(saved.files) ? saved.files : [];
    const version = entries.some((file) => record(file).id === ROOT_ID)
      ? 3
      : entries.some((file) => record(file).id === "drive-c")
        ? 2
        : 1;
    const parsed = parseBackup({ version, files: saved.files });
    if (!parsed)
      throw new Error("The saved workspace contains invalid file data.");
    files = parsed;
  }
  const workspace = saved.workspace === 1 ? 1 : 0;
  const ids = new Set<string>();
  const windows: WindowState[] = [];
  for (const entry of Array.isArray(saved.windows) ? saved.windows : []) {
    const win = record(entry);
    if (
      typeof win.id !== "string" ||
      !win.id ||
      ids.has(win.id) ||
      !appIds.includes(win.app as AppId)
    )
      continue;
    const app = win.app as AppId;
    if (app === "editor" && typeof win.fileId === "string") {
      const file = files.find((entry) => entry.id === win.fileId);
      if (!file || file.kind !== "text" || !isTextFileName(file.name)) continue;
    }
    const minimum = windowMinimums[app];
    const legacyFolder = (value: unknown) =>
      typeof value === "string"
        ? ["drive-c", "users", "home"].includes(value)
          ? ROOT_ID
          : value
        : undefined;
    const rect = (data: Record<string, unknown>) => ({
      x: finite(data.x, 16),
      y: finite(data.y, 54),
      width: Math.max(minimum.width, finite(data.width, 820)),
      height: Math.max(minimum.height, finite(data.height, 520)),
    });
    ids.add(win.id);
    windows.push({
      id: win.id,
      app,
      title: text(win.title, appNames[app]),
      ...rect(win),
      z: finite(win.z, windows.length + 1),
      minimized: win.minimized === true,
      maximized: win.maximized === true,
      workspace: win.workspace === 1 ? 1 : 0,
      fileId:
        app === "files"
          ? legacyFolder(win.fileId)
          : typeof win.fileId === "string"
            ? win.fileId
            : undefined,
      folderId: app === "files" ? legacyFolder(win.folderId) : undefined,
      restore: win.restore ? rect(record(win.restore)) : undefined,
    });
  }
  // Compact stacking order so persisted values cannot overtake desktop panels.
  windows
    .sort((a, b) => a.z - b.z)
    .forEach((win, index) => {
      win.z = index + 1;
    });
  return {
    files,
    windows,
    workspace,
    activeId: windows.some(
      (win) =>
        win.id === saved.activeId &&
        !win.minimized &&
        win.workspace === workspace,
    )
      ? (saved.activeId as string)
      : topWindowId(windows, workspace),
    ...restoreTheme(saved),
    wallpaperMode: choice(
      saved.wallpaperMode,
      ["preset", "solid", "image"],
      "preset",
    ),
    wallpaperColor: /^#[0-9a-f]{6}$/i.test(text(saved.wallpaperColor))
      ? text(saved.wallpaperColor)
      : "#1f2923",
    wallpaperFit: choice(saved.wallpaperFit, ["cover", "contain"], "cover"),
    wallpaperImageName: text(saved.wallpaperImageName),
    wallpaperRevision: Math.max(0, finite(saved.wallpaperRevision, 0)),
  };
}
