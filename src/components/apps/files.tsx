"use client";
import { useEffect, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Pencil,
  Scissors,
  ClipboardPaste,
  FolderClosed,
} from "lucide-react";
import { useOS, type WindowState } from "@/lib/store";
import {
  ancestors,
  childrenOf,
  filePath,
  isAvailable,
  isProtected,
  nextAvailableName,
  type VFile,
  ROOT_ID,
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
} from "@/lib/filesystem";
import { FileItem, FileShortcut } from "../file-item";
import { FileContextMenu } from "../file-context-menu";
import { useFileRename } from "../use-file-rename";
import { useFileSelection } from "../use-file-selection";
import { useFileDrop } from "../file-drag";

export default function Files({ win }: { win: WindowState }) {
  const files = useOS((s) => s.files),
    open = useOS((s) => s.openApp),
    cutId = useOS((s) => s.cutFileId);
  const folder = win.folderId ?? win.fileId ?? ROOT_ID;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    fileId?: string;
    sidebar?: boolean;
  } | null>(null);
  const { beginRename, renameProps, cancelRename } = useFileRename();
  const trash = folder === "trash";
  const current = files.find((f) => f.id === folder);
  const systemFolders = [DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID];
  const sidebarEntries = systemFolders.flatMap((id) =>
    files.filter((file) => file.id === id && isAvailable(files, id)),
  );
  const rootEntries = [
    ...sidebarEntries,
    ...childrenOf(files, ROOT_ID).filter(
      (file) => !systemFolders.includes(file.id),
    ),
  ];
  const folderEntries = trash
    ? files.filter((f) => f.trashed)
    : folder === ROOT_ID
      ? rootEntries
      : childrenOf(files, folder);
  const entries = folderEntries.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );
  const selection = useFileSelection(`${folder}:${query}`, entries);
  const selectedFile = selection.single;
  const movable = selection.selectedFiles
    .filter((file) => !isProtected(file.id))
    .map((file) => file.id);
  const menuFile = files.find((file) => file.id === menu?.fileId);
  const menuTrashed = Boolean(menuFile?.trashed);
  const menuTargets = menu?.sidebar
    ? menuFile
      ? [menuFile]
      : []
    : selection.selectedFiles;
  const menuMovable = menuTargets
    .filter((file) => !isProtected(file.id))
    .map((file) => file.id);
  const drop = useFileDrop(trash ? null : folder);
  const trashDrop = useFileDrop("trash");
  function navigate(id: string) {
    setMenu(null);
    cancelRename();
    useOS.getState().updateWindow(win.id, {
      folderId: id,
      title:
        id === "trash"
          ? "trash"
          : (files.find((f) => f.id === id)?.name ?? "Files"),
    });
    selection.clear();
    setQuery("");
  }
  function paste() {
    setMenu(null);
    const result = useOS.getState().pasteFile(folder);
    if (!result.ok) useOS.getState().notify("Cannot move", result.error);
  }
  function context(event: React.MouseEvent, file?: VFile, sidebar = false) {
    if ((event.target as HTMLElement).closest("input,textarea")) return;
    event.preventDefault();
    event.stopPropagation();
    if (trash && !file) {
      setMenu(null);
      return;
    }
    selection.context(sidebar ? undefined : file?.id);
    if (
      !sidebar &&
      file &&
      selection.selected.has(file.id) &&
      selection.ids.length > 1 &&
      !movable.length &&
      !cutId
    ) {
      setMenu(null);
      return;
    }
    setMenu({ x: event.clientX, y: event.clientY, fileId: file?.id, sidebar });
  }
  function openFile(file: VFile) {
    setMenu(null);
    if (file.kind === "folder") navigate(file.id);
    else open("editor", file.id);
  }
  function createItem(kind: VFile["kind"]) {
    const state = useOS.getState();
    const name = nextAvailableName(
      state.files,
      folder,
      kind === "folder" ? "New folder" : "New Text Document.txt",
    );
    const id = state.createFile(folder, name, kind);
    if (!id) {
      state.notify("Cannot create item", "Choose a different name.");
      return;
    }
    setMenu(null);
    setQuery("");
    selection.set([id]);
    beginRename(useOS.getState().files.find((file) => file.id === id)!);
  }
  useEffect(() => {
    if (!trash && !isAvailable(files, folder)) navigate(ROOT_ID);
    if (trash && win.title !== "trash")
      useOS.getState().updateWindow(win.id, { title: "trash" });
  }, [files, folder, trash, win.id, win.title]);
  return (
    <div
      className="files-app"
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            'input,textarea,[role="dialog"]',
          )
        )
          return;
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "x" &&
          movable.length &&
          !trash
        ) {
          event.preventDefault();
          useOS.getState().cutFiles(movable);
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "v" &&
          cutId &&
          !trash
        ) {
          event.preventDefault();
          paste();
        }
        if (
          event.key === "F2" &&
          selectedFile &&
          !trash &&
          !isProtected(selectedFile.id)
        ) {
          event.preventDefault();
          beginRename(selectedFile);
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "a"
        ) {
          event.preventDefault();
          selection.set(entries.map((file) => file.id));
        }
        if (event.key === "Delete" && movable.length && !trash) {
          event.preventDefault();
          useOS.getState().trashFiles(movable);
          selection.clear();
        }
        if (event.key === "Escape") {
          setMenu(null);
          selection.clear();
        }
      }}
    >
      <aside className="app-sidebar">
        {sidebarEntries.map((file) => (
          <FileShortcut
            key={file.id}
            id={file.id}
            current={folder}
            selected={selection.selected.has(file.id)}
            onSelect={(file) => {
              selection.set([file.id]);
              setMenu(null);
            }}
            onOpen={openFile}
            onContextMenu={(event, file) => context(event, file, true)}
          />
        ))}
        <div className="sidebar-divider" />
        <FileShortcut
          id={ROOT_ID}
          current={folder}
          selected={selection.selected.has(ROOT_ID)}
          onSelect={(file) => {
            selection.set([file.id]);
            setMenu(null);
          }}
          onOpen={openFile}
          onContextMenu={(event, file) => context(event, file, true)}
        />
        <button
          className={`${trash ? "selected" : ""} ${trashDrop.highlighted ? "file-drop-target" : ""}`}
          {...trashDrop.handlers}
          onClick={() => navigate("trash")}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setMenu({
              x: event.clientX,
              y: event.clientY,
              fileId: "trash",
              sidebar: true,
            });
          }}
        >
          <Trash2 size={17} />
          trash
          <span className="count">
            {files.filter((f) => f.trashed).length || ""}
          </span>
        </button>
      </aside>
      <section className="files-main" onContextMenu={(event) => context(event)}>
        <div className="app-toolbar">
          <button
            className="icon-button"
            aria-label="Parent folder"
            disabled={!trash && !current?.parent}
            onClick={() => navigate(current?.parent ?? ROOT_ID)}
          >
            <ArrowUp size={17} />
          </button>
          <nav className="breadcrumbs" aria-label="Folder path">
            {trash ? (
              <span>trash</span>
            ) : (
              ancestors(files, folder).map((file, index) => (
                <span className="breadcrumb-part" key={file.id}>
                  {index > 0 && <ChevronRight size={12} />}
                  <Breadcrumb
                    id={file.id}
                    name={file.name}
                    current={folder}
                    navigate={navigate}
                  />
                </span>
              ))
            )}
          </nav>
          <div className="toolbar-spacer" />
          {cutId && !trash && (
            <button className="small-button" onClick={paste}>
              <ClipboardPaste size={14} />
              Paste
            </button>
          )}
          {folderEntries.length > 0 && (
            <button
              className="icon-button"
              aria-label="Toggle file view"
              onClick={() => setView(view === "grid" ? "list" : "grid")}
            >
              {view === "grid" ? <List size={17} /> : <LayoutGrid size={17} />}
            </button>
          )}
        </div>
        <div className="folder-heading">
          <h2>{trash ? "trash" : current?.name}</h2>
          {(folderEntries.length > 0 || query.length > 0) && (
            <label className="inline-search">
              <Search size={14} />
              <input
                aria-label="Search this folder"
                placeholder="Search this folder"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
        </div>
        <div
          className={`file-entries ${view} ${drop.highlighted ? "file-drop-target" : ""}`}
          {...drop.handlers}
          ref={selection.ref}
          tabIndex={0}
          aria-label="Files in current folder"
          {...selection.handlers}
        >
          {entries.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              selected={selection.selected.has(file.id)}
              selectedIds={selection.ids}
              onDragSelection={() => selection.set([file.id])}
              view={view}
              trashed={trash}
              rename={renameProps(file)}
              onContextMenu={(event) => context(event, file)}
              onSelect={(event) => selection.select(file.id, event)}
              onOpen={() =>
                file.kind === "folder"
                  ? navigate(file.id)
                  : open("editor", file.id)
              }
            />
          ))}
          {selection.box && (
            <div
              className="file-selection-box"
              aria-hidden="true"
              style={{
                left: selection.box.x,
                top: selection.box.y,
                width: selection.box.width,
                height: selection.box.height,
              }}
            />
          )}
          {!entries.length && (
            <div className="empty-state">
              <FolderClosed size={36} strokeWidth={1} />
              <p>{query ? "No matches." : "This folder is empty."}</p>
            </div>
          )}
        </div>
        <div className="files-status">
          <span title={trash ? "trash" : filePath(files, folder)}>
            {entries.length} items
            {selection.ids.length > 1
              ? ` · ${selection.ids.length} selected`
              : selectedFile
                ? " · " + selectedFile.name
                : ""}
          </span>
          <div>
            {selection.ids.length > 0 &&
              (trash ? (
                <button
                  onClick={() => {
                    useOS.getState().restoreFiles(selection.ids);
                    selection.clear();
                  }}
                >
                  Restore
                </button>
              ) : (
                movable.length > 0 && (
                  <>
                    <button
                      aria-label="Cut selected items"
                      title="Cut (Ctrl+X)"
                      onClick={() => useOS.getState().cutFiles(movable)}
                    >
                      <Scissors size={14} />
                    </button>
                    {selectedFile && !isProtected(selectedFile.id) && (
                      <button
                        aria-label="Rename selected item"
                        onClick={() => beginRename(selectedFile)}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      aria-label="Move selected items to Trash"
                      onClick={() => {
                        useOS.getState().trashFiles(movable);
                        selection.clear();
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )
              ))}
          </div>
        </div>
      </section>
      {menu && (
        <FileContextMenu
          x={menu.x}
          y={menu.y}
          hasSelection={menuTargets.length > 0 || menu.fileId === "trash"}
          multiple={menuTargets.length > 1}
          protectedItem={
            menu.fileId === "trash" ||
            (menuTargets.length > 0 && !menuMovable.length)
          }
          trashed={menuTrashed}
          canPaste={
            Boolean(cutId) &&
            !menuTrashed &&
            (menu.sidebar ? menuFile?.kind === "folder" : !trash)
          }
          onCreate={createItem}
          onOpen={() => {
            if (menu.fileId === "trash") navigate("trash");
            else if (menuFile) openFile(menuFile);
          }}
          onCut={() => {
            useOS.getState().cutFiles(menuMovable);
            setMenu(null);
          }}
          onRename={() => {
            if (menuFile) {
              if (menu.sidebar && menuFile.parent) {
                navigate(menuFile.parent);
                selection.set([menuFile.id]);
              }
              beginRename(menuFile);
            }
            setMenu(null);
          }}
          onTrash={() => {
            useOS.getState().trashFiles(menuMovable);
            selection.clear();
            setMenu(null);
          }}
          onRestore={() => {
            useOS.getState().restoreFiles(menuTargets.map((file) => file.id));
            selection.clear();
            setMenu(null);
          }}
          onPaste={() => {
            if (menu.sidebar && menuFile?.kind === "folder") {
              const result = useOS.getState().pasteFile(menuFile.id);
              if (!result.ok)
                useOS.getState().notify("Cannot move", result.error);
              setMenu(null);
            } else paste();
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
function Breadcrumb({
  id,
  name,
  current,
  navigate,
}: {
  id: string;
  name: string;
  current: string;
  navigate: (id: string) => void;
}) {
  const drop = useFileDrop(id);
  return (
    <button
      {...drop.handlers}
      className={drop.highlighted ? "file-drop-target" : ""}
      aria-current={id === current ? "location" : undefined}
      onClick={() => navigate(id)}
    >
      {name}
    </button>
  );
}
