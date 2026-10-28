"use client";
import { useEffect, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Plus,
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
import { FileItem, FolderShortcut } from "../file-item";
import { FileContextMenu } from "../file-context-menu";
import { useFileRename } from "../use-file-rename";
import { useFileDrop } from "../file-drag";

export default function Files({ win }: { win: WindowState }) {
  const files = useOS((s) => s.files),
    open = useOS((s) => s.openApp),
    cutId = useOS((s) => s.cutFileId);
  const folder = win.folderId ?? win.fileId ?? ROOT_ID;
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    creationOnly?: boolean;
  } | null>(null);
  const { beginRename, renameProps, cancelRename } = useFileRename();
  const trash = folder === "trash";
  const current = files.find((f) => f.id === folder);
  const folderEntries = trash
    ? files.filter((f) => f.trashed)
    : childrenOf(files, folder);
  const entries = folderEntries.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedFile = entries.find((f) => f.id === selected);
  const drop = useFileDrop(trash ? null : folder);
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
    setSelected(null);
    setQuery("");
  }
  function paste() {
    setMenu(null);
    const result = useOS.getState().pasteFile(folder);
    if (!result.ok) useOS.getState().notify("Cannot move", result.error);
  }
  function context(event: React.MouseEvent, file?: VFile) {
    if ((event.target as HTMLElement).closest("input,textarea")) return;
    event.preventDefault();
    event.stopPropagation();
    if (trash && !file) {
      setMenu(null);
      return;
    }
    setSelected(file?.id ?? null);
    setMenu({ x: event.clientX, y: event.clientY });
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
    setSelected(id);
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
          selectedFile &&
          !trash &&
          !isProtected(selectedFile.id)
        ) {
          event.preventDefault();
          useOS.getState().cutFile(selectedFile.id);
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
          event.key === "Delete" &&
          selectedFile &&
          !trash &&
          !isProtected(selectedFile.id)
        ) {
          event.preventDefault();
          useOS.getState().trashFile(selectedFile.id);
          setSelected(null);
        }
        if (event.key === "Escape") setMenu(null);
      }}
    >
      <aside className="app-sidebar">
        {[DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID]
          .filter((id) => isAvailable(files, id))
          .map((id) => (
            <FolderShortcut
              key={id}
              id={id}
              current={folder}
              onNavigate={navigate}
            />
          ))}
        <div className="sidebar-divider" />
        <FolderShortcut id={ROOT_ID} current={folder} onNavigate={navigate} />
        <button
          className={trash ? "selected" : ""}
          onClick={() => navigate("trash")}
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
          <button
            className="icon-button"
            aria-label="Toggle file view"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List size={17} /> : <LayoutGrid size={17} />}
          </button>
          {!trash && (
            <button
              className="small-button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setSelected(null);
                setMenu(
                  menu?.creationOnly
                    ? null
                    : { x: rect.left, y: rect.bottom + 4, creationOnly: true },
                );
              }}
            >
              <Plus size={15} />
              New
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
          onClick={() => setSelected(null)}
        >
          {entries.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              selected={selected === file.id}
              view={view}
              trashed={trash}
              rename={renameProps(file)}
              onContextMenu={(event) => context(event, file)}
              onSelect={() => setSelected(file.id)}
              onOpen={() =>
                file.kind === "folder"
                  ? navigate(file.id)
                  : open("editor", file.id)
              }
            />
          ))}
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
            {selectedFile ? " · " + selectedFile.name : ""}
          </span>
          <div>
            {selectedFile &&
              (trash ? (
                <button
                  onClick={() => useOS.getState().restoreFile(selectedFile.id)}
                >
                  Restore
                </button>
              ) : (
                !isProtected(selectedFile.id) && (
                  <>
                    <button
                      aria-label="Cut selected item"
                      title="Cut (Ctrl+X)"
                      onClick={() => useOS.getState().cutFile(selectedFile.id)}
                    >
                      <Scissors size={14} />
                    </button>
                    <button
                      aria-label="Rename selected item"
                      onClick={() => {
                        if (selectedFile) beginRename(selectedFile);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label="Move selected item to Trash"
                      onClick={() => {
                        useOS.getState().trashFile(selectedFile.id);
                        setSelected(null);
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
          creationOnly={menu.creationOnly}
          hasSelection={Boolean(selectedFile)}
          protectedItem={selectedFile ? isProtected(selectedFile.id) : false}
          trashed={trash}
          canPaste={Boolean(cutId) && !trash}
          onCreate={createItem}
          onOpen={() => {
            if (selectedFile) openFile(selectedFile);
          }}
          onCut={() => {
            if (selectedFile) useOS.getState().cutFile(selectedFile.id);
            setMenu(null);
          }}
          onRename={() => {
            if (selectedFile) beginRename(selectedFile);
            setMenu(null);
          }}
          onTrash={() => {
            if (selectedFile) useOS.getState().trashFile(selectedFile.id);
            setSelected(null);
            setMenu(null);
          }}
          onRestore={() => {
            if (selectedFile) useOS.getState().restoreFile(selectedFile.id);
            setMenu(null);
          }}
          onPaste={paste}
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
