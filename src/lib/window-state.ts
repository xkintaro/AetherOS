export const appIds = ["files", "editor", "terminal", "settings"] as const;
export type AppId = (typeof appIds)[number];
export type WindowState = {
  id: string;
  app: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  workspace: number;
  fileId?: string;
  folderId?: string;
  restore?: { x: number; y: number; width: number; height: number };
};
export const appNames: Record<AppId, string> = {
  files: "Files",
  editor: "Text Editor",
  terminal: "Terminal",
  settings: "Settings",
};

export function topWindowId(
  windows: WindowState[],
  workspace: number,
): string | null {
  let top: WindowState | undefined;
  for (const win of windows) {
    if (
      !win.minimized &&
      win.workspace === workspace &&
      (!top || win.z > top.z)
    )
      top = win;
  }
  return top?.id ?? null;
}
