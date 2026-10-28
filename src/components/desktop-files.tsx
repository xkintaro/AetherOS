"use client";
import { useEffect, useState } from "react";
import { useOS } from "@/lib/store";
import {
  childrenOf,
  DESKTOP_ID,
  isProtected,
  moveError,
  nextAvailableName,
  type VFile,
} from "@/lib/filesystem";
import { desktopDropPosition, desktopLayout } from "@/lib/desktop-layout";
import { FileItem } from "./file-item";
import { FileContextMenu } from "./file-context-menu";
import { useFileRename } from "./use-file-rename";
import { endFileDrag, FILE_DRAG_TYPE } from "./file-drag";

export function DesktopFiles({ onInteract }: { onInteract: () => void }) {
  const files = useOS((s) => s.files),
    cutId = useOS((s) => s.cutFileId),
    dragged = useOS((s) => s.draggedFileId);
  const [selected, setSelected] = useState<string | null>(null),
    [hovered, setHovered] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    origin: { x: number; y: number };
  } | null>(null);
  const { beginRename: editName, renameProps } = useFileRename();
  const [area, setArea] = useState<{ width: number; height: number } | null>(
    null,
  );
  const entries = childrenOf(files, DESKTOP_ID),
    selectedFile = entries.find((f) => f.id === selected);
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
    setSelected(file?.id ?? null);
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
    setSelected(file.id);
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
    setSelected(id);
    editName(useOS.getState().files.find((file) => file.id === id)!);
  }
  return (
    <div
      className={`desktop-underlay desktop-files ${hovered && dragged ? "desktop-drop-target" : ""}`}
      tabIndex={0}
      aria-label="Desktop files"
      onPointerDown={onInteract}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setSelected(null);
          setMenu(null);
          event.currentTarget.focus();
        }
      }}
      onContextMenu={(event) => context(event)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(FILE_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect =
          dragged && !moveError(files, dragged, DESKTOP_ID) ? "move" : "none";
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
        const id = event.dataTransfer.getData(FILE_DRAG_TYPE);
        const rect = event.currentTarget.getBoundingClientRect();
        if (id) {
          const position = placement(id, {
            x: event.clientX - rect.left + event.currentTarget.scrollLeft - 40,
            y: event.clientY - rect.top + event.currentTarget.scrollTop - 40,
          });
          const result = useOS.getState().moveFile(id, DESKTOP_ID, position);
          if (!result.ok) useOS.getState().notify("Cannot move", result.error);
          else setSelected(id);
        }
        endFileDrag();
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('input,[role="dialog"]'))
          return;
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "x" &&
          selectedFile
        ) {
          event.preventDefault();
          useOS.getState().cutFile(selectedFile.id);
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
        if (event.key === "Delete" && selectedFile) {
          event.preventDefault();
          useOS.getState().trashFile(selectedFile.id);
          setSelected(null);
        }
        if (event.key === "Escape") {
          setMenu(null);
          setSelected(null);
        }
      }}
    >
      {entries.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          selected={selected === file.id}
          view="desktop"
          rename={renameProps(file)}
          style={{
            left: positions.get(file.id)?.x,
            top: positions.get(file.id)?.y,
          }}
          onSelect={() => {
            setSelected(file.id);
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
      {menu && (
        <>
          <FileContextMenu
            x={menu.x}
            y={menu.y}
            hasSelection={Boolean(selectedFile)}
            protectedItem={selectedFile ? isProtected(selectedFile.id) : false}
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
              if (selectedFile) useOS.getState().cutFile(selectedFile.id);
              setMenu(null);
            }}
            onRename={() => {
              if (selectedFile) beginRename(selectedFile);
            }}
            onTrash={() => {
              if (selectedFile) useOS.getState().trashFile(selectedFile.id);
              setSelected(null);
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
