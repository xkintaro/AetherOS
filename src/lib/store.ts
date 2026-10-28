"use client";
import { defaultAccent, isHexColor, type Theme } from "./theme";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { resilientStorage, STORAGE_ERROR_EVENT } from "./storage";
import { restoreSession } from "./session";
import { windowMinimums } from "./window-geometry";
import {
  initialFiles,
  validName,
  isTextFileName,
  isAvailable,
  isProtected,
  hasNameConflict,
  moveEntry,
  parseBackup,
  ROOT_ID,
  type VFile,
  type Position,
  type FileResult,
} from "./filesystem";

import {
  appNames,
  topWindowId,
  type AppId,
  type WindowState,
} from "./window-state";
export { appIds, appNames, type AppId, type WindowState } from "./window-state";
type Notice = { id: string; title: string; message: string; time: number };
type State = {
  files: VFile[];
  windows: WindowState[];
  activeId: string | null;
  workspace: number;
  theme: Theme;
  accentColor: string;
  wallpaperMode: "preset" | "solid" | "image";
  wallpaperColor: string;
  wallpaperFit: "cover" | "contain";
  wallpaperImageName: string;
  wallpaperRevision: number;
  notices: Notice[];
  unsupportedFile: string | null;
  cutFileId: string | null;
  draggedFileId: string | null;
  setDraggedFile: (id: string | null) => void;
  cutFile: (id: string | null) => void;
  moveFile: (id: string, parent: string, position?: Position) => FileResult;
  pasteFile: (parent: string) => FileResult;
  openApp: (app: AppId, fileId?: string) => void;
  focus: (id: string) => void;
  updateWindow: (id: string, data: Partial<WindowState>) => void;
  close: (id: string) => void;
  maximize: (id: string) => void;
  setWorkspace: (n: number) => void;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: string) => void;
  setWallpaperMode: (mode: State["wallpaperMode"]) => void;
  setWallpaperColor: (color: string) => void;
  setWallpaperFit: (fit: State["wallpaperFit"]) => void;
  setWallpaperImage: (name: string) => void;
  createFile: (
    parent: string,
    name: string,
    kind: VFile["kind"],
    content?: string,
  ) => string | null;
  saveFile: (id: string, content: string) => void;
  renameFile: (id: string, name: string) => boolean;
  trashFile: (id: string) => void;
  restoreFile: (id: string) => void;
  notify: (title: string, message: string) => void;
  clearNotices: () => void;
  importBackup: (data: unknown) => boolean;
};
const nextZ = (windows: WindowState[]) =>
  Math.max(0, ...windows.map((w) => w.z)) + 1;
// Do not overwrite unreadable saved files with the temporary default workspace.
let persistenceBlocked = false;
export const useOS = create<State>()(
  persist(
    (set, get) => ({
      files: initialFiles,
      windows: [],
      activeId: null,
      workspace: 0,
      theme: "dark",
      accentColor: defaultAccent,
      wallpaperMode: "preset",
      wallpaperColor: "#1f2923",
      wallpaperFit: "cover",
      wallpaperImageName: "",
      wallpaperRevision: 0,
      notices: [],
      unsupportedFile: null,
      cutFileId: null,
      draggedFileId: null,
      setDraggedFile: (draggedFileId) => set({ draggedFileId }),
      cutFile: (cutFileId) => set({ cutFileId }),
      moveFile: (id, parent, position) => {
        const next = moveEntry(get().files, id, parent, position);
        if (next.result.ok)
          set({
            files: next.files,
            cutFileId: get().cutFileId === id ? null : get().cutFileId,
          });
        return next.result;
      },
      pasteFile: (parent) => {
        const id = get().cutFileId;
        return id
          ? get().moveFile(id, parent)
          : { ok: false, error: "Cut an item first." };
      },
      openApp: (app, fileId) => {
        const s = get();
        if (app === "editor" && fileId) {
          const file = s.files.find((entry) => entry.id === fileId);
          if (!file || file.kind !== "text" || !isAvailable(s.files, fileId)) {
            s.notify("Cannot open file", "The file is no longer available.");
            return;
          }
          if (!isTextFileName(file.name)) {
            set({ unsupportedFile: file.name });
            return;
          }
        }
        const existing = s.windows.find(
          (w) => w.app === app && w.fileId === fileId,
        );
        if (existing) {
          set({ workspace: existing.workspace });
          if (app === "files" && fileId)
            get().updateWindow(existing.id, {
              folderId: fileId,
              title:
                s.files.find((f) => f.id === fileId)?.name ?? appNames.files,
            });
          get().focus(existing.id);
          return;
        }
        const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
        const vh = typeof window !== "undefined" ? window.innerHeight : 900;
        const width = Math.max(
          windowMinimums[app].width,
          Math.min(app === "settings" ? 760 : 820, vw - 48),
        );
        const height = Math.max(
          windowMinimums[app].height,
          Math.min(520, vh - 150),
        );
        const offset = (s.windows.length % 4) * 28;
        const id = crypto.randomUUID();
        set({
          windows: [
            ...s.windows,
            {
              id,
              app,
              fileId,
              folderId: app === "files" ? (fileId ?? ROOT_ID) : undefined,
              title: fileId
                ? (s.files.find((f) => f.id === fileId)?.name ?? appNames[app])
                : appNames[app],
              x: Math.max(16, (vw - width) / 2 + offset),
              y: Math.max(54, (vh - height) / 2 - 36 + offset),
              width,
              height,
              z: nextZ(s.windows),
              minimized: false,
              maximized: false,
              workspace: s.workspace,
            },
          ],
          activeId: id,
        });
      },
      focus: (id) => {
        const state = get();
        const win = state.windows.find((w) => w.id === id);
        if (
          !win ||
          (state.activeId === id &&
            !win.minimized &&
            state.workspace === win.workspace)
        )
          return;
        set({
          activeId: id,
          workspace: win.workspace,
          windows: state.windows.map((w) =>
            w.id === id
              ? { ...w, minimized: false, z: nextZ(state.windows) }
              : w,
          ),
        });
      },
      updateWindow: (id, data) =>
        set((s) => {
          const current = s.windows.find((win) => win.id === id);
          if (
            !current ||
            Object.entries(data).every(
              ([key, value]) => current[key as keyof WindowState] === value,
            )
          )
            return s;
          const windows = s.windows.map((w) =>
            w.id === id
              ? {
                  ...w,
                  ...data,
                  width: Math.max(
                    windowMinimums[w.app].width,
                    data.width ?? w.width,
                  ),
                  height: Math.max(
                    windowMinimums[w.app].height,
                    data.height ?? w.height,
                  ),
                }
              : w,
          );
          return {
            windows,
            activeId:
              data.minimized && s.activeId === id
                ? topWindowId(windows, s.workspace)
                : s.activeId,
          };
        }),
      close: (id) =>
        set((s) => {
          if (!s.windows.some((win) => win.id === id)) return s;
          const windows = s.windows.filter((w) => w.id !== id);
          return {
            windows,
            activeId:
              s.activeId === id
                ? topWindowId(windows, s.workspace)
                : s.activeId,
          };
        }),
      maximize: (id) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id !== id
              ? w
              : w.maximized
                ? { ...w, ...w.restore, maximized: false, restore: undefined }
                : {
                    ...w,
                    maximized: true,
                    restore: {
                      x: w.x,
                      y: w.y,
                      width: w.width,
                      height: w.height,
                    },
                  },
          ),
        })),
      setWorkspace: (workspace) => {
        if (workspace !== 0 && workspace !== 1) return;
        set((s) => ({
          workspace,
          activeId: topWindowId(s.windows, workspace),
        }));
      },
      setTheme: (theme) => {
        if (theme === "dark" || theme === "light") set({ theme });
      },
      setAccentColor: (accentColor) => {
        if (isHexColor(accentColor))
          set({ accentColor: accentColor.toLowerCase() });
      },
      setWallpaperMode: (wallpaperMode) => set({ wallpaperMode }),
      setWallpaperColor: (wallpaperColor) => {
        if (/^#[0-9a-f]{6}$/i.test(wallpaperColor))
          set({ wallpaperColor, wallpaperMode: "solid" });
      },
      setWallpaperFit: (wallpaperFit) => set({ wallpaperFit }),
      setWallpaperImage: (wallpaperImageName) =>
        set((state) => ({
          wallpaperImageName,
          wallpaperRevision: state.wallpaperRevision + 1,
          wallpaperMode: wallpaperImageName ? "image" : "preset",
        })),
      createFile: (parent, name, kind, content = "") => {
        const s = get();
        const dir = s.files.find((f) => f.id === parent && f.kind === "folder");
        if (
          !dir ||
          !isAvailable(s.files, parent) ||
          !validName(name) ||
          hasNameConflict(s.files, parent, name)
        )
          return null;
        const id = crypto.randomUUID();
        set({
          files: [
            ...s.files,
            { id, name, parent, kind, content, modified: Date.now() },
          ],
        });
        return id;
      },
      saveFile: (id, content) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id ? { ...f, content, modified: Date.now() } : f,
          ),
        })),
      renameFile: (id, name) => {
        const s = get();
        const f = s.files.find((f) => f.id === id);
        if (
          !f ||
          isProtected(id) ||
          !isAvailable(s.files, id) ||
          !validName(name) ||
          hasNameConflict(s.files, f.parent, name, id)
        )
          return false;
        set({
          files: s.files.map((x) =>
            x.id === id ? { ...x, name, modified: Date.now() } : x,
          ),
          windows: s.windows.map((w) =>
            (w.app === "editor" && w.fileId === id) ||
            (w.app === "files" && w.folderId === id)
              ? { ...w, title: name }
              : w,
          ),
        });
        return true;
      },
      trashFile: (id) => {
        if (isProtected(id)) return;
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id ? { ...f, trashed: true } : f,
          ),
          cutFileId: s.cutFileId === id ? null : s.cutFileId,
        }));
      },
      restoreFile: (id) => {
        const s = get();
        const f = s.files.find((f) => f.id === id);
        if (!f) return;
        if (!f.parent || !isAvailable(s.files, f.parent)) {
          s.notify("Cannot restore", "Restore the parent folder first.");
          return;
        }
        if (hasNameConflict(s.files, f.parent, f.name, id)) {
          s.notify("Cannot restore", "An item with this name already exists.");
          return;
        }
        set({
          files: s.files.map((x) =>
            x.id === id ? { ...x, trashed: false } : x,
          ),
        });
      },
      notify: (title, message) =>
        set((s) => ({
          notices: [
            { id: crypto.randomUUID(), title, message, time: Date.now() },
            ...s.notices,
          ].slice(0, 30),
        })),
      clearNotices: () => set({ notices: [] }),
      importBackup: (data) => {
        const files = parseBackup(data);
        if (!files) return false;
        persistenceBlocked = false;
        set({
          files,
          windows: [],
          activeId: null,
          cutFileId: null,
          draggedFileId: null,
        });
        get().notify("Backup restored", files.length + " items restored.");
        return true;
      },
    }),
    {
      name: "aetheros-v1",
      version: 5,
      migrate: (persisted) => persisted,
      merge: (persisted, current) => ({
        ...current,
        ...restoreSession(persisted),
      }),
      storage: createJSONStorage(() => {
        const storage = localStorage;
        return resilientStorage(
          {
            getItem: (name) => storage.getItem(name),
            removeItem: (name) => storage.removeItem(name),
            setItem: (name, value) => {
              if (persistenceBlocked) return;
              storage.setItem(name, value);
            },
          },
          () => {
            window.dispatchEvent(new Event(STORAGE_ERROR_EVENT));
          },
        );
      }),
      partialize: (s) => ({
        files: s.files,
        windows: s.windows,
        activeId: s.activeId,
        workspace: s.workspace,
        theme: s.theme,
        accentColor: s.accentColor,
        wallpaperMode: s.wallpaperMode,
        wallpaperColor: s.wallpaperColor,
        wallpaperFit: s.wallpaperFit,
        wallpaperImageName: s.wallpaperImageName,
        wallpaperRevision: s.wallpaperRevision,
      }),
      onRehydrateStorage: () => (_state, error) => {
        persistenceBlocked = Boolean(error);
        if (error) {
          console.error("Workspace could not be restored", error);
          queueMicrotask(() =>
            useOS
              .getState()
              .notify(
                "Workspace could not be restored",
                "Saved data has been preserved. Changes are temporary until you restore a valid backup in Settings.",
              ),
          );
        }
      },
    },
  ),
);
