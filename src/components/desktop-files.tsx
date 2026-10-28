"use client";
import { useEffect, useState } from "react";
import { useOS } from "@/lib/store";
import {
  childrenOf,
  DESKTOP_ID,
  isProtected,
  moveEntries,
  nextAvailableName,
  type VFile,
} from "@/lib/filesystem";
import {
  desktopDropPosition,
  desktopLayout,
  desktopGroupPositions,
} from "@/lib/desktop-layout";
import { FileItem } from "./file-item";
import { FileContextMenu } from "./file-context-menu";
import { useFileRename } from "./use-file-rename";
import { useFileSelection } from "./use-file-selection";
import { endFileDrag, FILE_DRAG_TYPE, draggedFileIds } from "./file-drag";

export function DesktopFiles({ onInteract }: { onInteract: () => void }) {
  const files = useOS((s) => s.files),
    cutId = useOS((s) => s.cutFileId),
    dragged = useOS((s) => s.draggedFileId);
  const [hovered, setHovered] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    origin: { x: number; y: number };
  } | null>(null);
  const { beginRename: editName, renameProps } = useFileRename();
  const [area, setArea] = useState<{ width: number; height: number } | null>(
    null,
  );
  const entries = childrenOf(files, DESKTOP_ID);
  const selection = useFileSelection("desktop", entries);
  const selectedFile = selection.single;
  const movable = selection.selectedFiles
    .filter((file) => !isProtected(file.id))
    .map((file) => file.id);
  const positions = desktopLayout(
    entries,
    area?.height ?? 640,
    area?.width ?? 1024,
  );
  useEffect(() => {
    const resize = () =>
      setArea({
        width: window.innerWidth,
        height: window.innerHeight - (window.innerWidth <= 800 ? 154 : 104),
      });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!area) return;
    const current = useOS.getState().files;
    const layout = desktopLayout(
      childrenOf(current, DESKTOP_ID),
      area.height,
      area.width,
    );
    let changed = false;
    const positioned = current.map((file) => {
      const position = layout.get(file.id);
      if (
        !position ||
        (file.desktopPosition?.x === position.x &&
          file.desktopPosition?.y === position.y)
      )
        return file;
      changed = true;
      return { ...file, desktopPosition: position };
    });
    if (changed) useOS.setState({ files: positioned });
  }, [files, area]);

  function placement(id: string, point: { x: number; y: number }) {
    return desktopDropPosition(
      childrenOf(useOS.getState().files, DESKTOP_ID),
      id,
      point,
      area?.height ?? 640,
      area?.width ?? 1024,
    );
  }

  function paste() {
    const result = useOS.getState().pasteFile(DESKTOP_ID);
    if (!result.ok) useOS.getState().notify("Cannot move", result.error);
    setMenu(null);
  }
  function context(event: React.MouseEvent, file?: VFile) {
    event.preventDefault();
    event.stopPropagation();
    onInteract();
    selection.context(file?.id);
    const desktop = event.currentTarget.closest<HTMLElement>(".desktop-files")!;
    const rect = desktop.getBoundingClientRect();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      origin: {
        x: event.clientX - rect.left + desktop.scrollLeft,
        y: event.clientY - rect.top + desktop.scrollTop,
      },
    });
  }
  function beginRename(file: VFile) {
    setMenu(null);
    selection.set([file.id]);
    editName(file);
  }
  function createItem(kind: VFile["kind"]) {
    const state = useOS.getState();
    const name = nextAvailableName(
      state.files,
      DESKTOP_ID,
      kind === "folder" ? "New folder" : "New Text Document.txt",
    );
    const id = state.createFile(DESKTOP_ID, name, kind);
    if (!id) {
      state.notify("Cannot create item", "Choose a different name.");
      return;
    }
    if (menu) state.moveFile(id, DESKTOP_ID, placement(id, menu.origin));
    setMenu(null);
    selection.set([id]);
    editName(useOS.getState().files.find((file) => file.id === id)!);
  }
  return (
    <div
      className={`desktop-underlay desktop-files ${hovered && dragged ? "desktop-drop-target" : ""}`}
      tabIndex={0}
      aria-label="Desktop files"
      ref={selection.ref}
      {...selection.handlers}
      onPointerDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        onInteract();
        setMenu(null);
        selection.handlers.onPointerDown(event);
      }}
      onContextMenu={(event) => context(event)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(FILE_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect =
          dragged &&
          moveEntries(files, useOS.getState().draggedFileIds, DESKTOP_ID).result
            .ok
            ? "move"
            : "none";
        setHovered(true);
      }}
      onDragLeave={(event) => {
        if (!(
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ))
          setHovered(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(FILE_DRAG_TYPE)) return;
        event.preventDefault();
        event.stopPropagation();
        setHovered(false);
        const ids = draggedFileIds(event);
        const rect = event.currentTarget.getBoundingClientRect();
        if (ids.length) {
          const point = {
            x: event.clientX - rect.left + event.currentTarget.scrollLeft - 40,
            y: event.clientY - rect.top + event.currentTarget.scrollTop - 40,
          };
          const group = desktopGroupPositions(
            childrenOf(useOS.getState().files, DESKTOP_ID),
            ids,
            ids[0],
            point,
            area?.height ?? 640,
            area?.width ?? 1024,
          );
          const result = useOS.getState().moveFiles(ids, DESKTOP_ID, group);
          if (!result.ok) useOS.getState().notify("Cannot move", result.error);
          else selection.set(ids);
        }
        endFileDrag();
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('input,[role="dialog"]'))
          return;
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "a"
        ) {
          event.preventDefault();
          selection.set(entries.map((file) => file.id));
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "x" &&
          movable.length
        ) {
          event.preventDefault();
          useOS.getState().cutFiles(movable);
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "v" &&
          cutId
        ) {
          event.preventDefault();
          paste();
        }
        if (event.key === "F2" && selectedFile) {
          event.preventDefault();
          beginRename(selectedFile);
        }
        if (event.key === "Delete" && movable.length) {
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
      {entries.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          selected={selection.selected.has(file.id)}
          selectedIds={selection.ids}
          onDragSelection={() => selection.set([file.id])}
          view="desktop"
          rename={renameProps(file)}
          style={{
            left: positions.get(file.id)?.x,
            top: positions.get(file.id)?.y,
          }}
          onSelect={(event) => {
            selection.select(file.id, event);
            setMenu(null);
          }}
          onOpen={() =>
            useOS
              .getState()
              .openApp(file.kind === "folder" ? "files" : "editor", file.id)
          }
          onContextMenu={(event) => context(event, file)}
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
      {menu && (
        <>
          <FileContextMenu
            x={menu.x}
            y={menu.y}
            hasSelection={selection.ids.length > 0}
            multiple={selection.ids.length > 1}
            protectedItem={!movable.length}
            label="Desktop menu"
            onOpen={() => {
              if (selectedFile)
                useOS
                  .getState()
                  .openApp(
                    selectedFile.kind === "folder" ? "files" : "editor",
                    selectedFile.id,
                  );
              setMenu(null);
            }}
            canPaste={Boolean(cutId)}
            onCreate={createItem}
            onCut={() => {
              useOS.getState().cutFiles(movable);
              setMenu(null);
            }}
            onRename={() => {
              if (selectedFile) beginRename(selectedFile);
            }}
            onTrash={() => {
              useOS.getState().trashFiles(movable);
              selection.clear();
              setMenu(null);
            }}
            onPaste={paste}
            onClose={() => setMenu(null)}
          />
        </>
      )}
    </div>
  );
}
