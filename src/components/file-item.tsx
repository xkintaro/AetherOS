"use client";
import { useEffect, useRef } from "react";
import { childrenOf, isProtected, type VFile } from "@/lib/filesystem";
import { FileIcon } from "./file-icon";
import { useOS } from "@/lib/store";
import { endFileDrag, startFileDrag, useFileDrop } from "./file-drag";

export function FileItem({
  file,
  selected,
  selectedIds = [],
  onDragSelection,
  view = "grid",
  trashed = false,
  onSelect,
  onOpen,
  onContextMenu,
  style,
  rename,
}: {
  file: VFile;
  selected: boolean;
  selectedIds?: string[];
  onDragSelection?: () => void;
  view?: "grid" | "list" | "desktop";
  trashed?: boolean;
  onSelect: (event: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  style?: React.CSSProperties;
  rename?: {
    value: string;
    error: string;
    onChange: (value: string) => void;
    onCommit: () => boolean;
    onCancel: () => void;
  };
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const itemButton = useRef<HTMLButtonElement | null>(null);
  const wasRenaming = useRef(false);
  const renaming = Boolean(rename);
  useEffect(() => {
    if (renaming && nameInput.current) {
      nameInput.current.focus();
      const name = nameInput.current.value;
      const dot = file.kind === "text" ? name.lastIndexOf(".") : -1;
      nameInput.current.setSelectionRange(0, dot > 0 ? dot : name.length);
    }
    if (!renaming && wasRenaming.current) itemButton.current?.focus();
    wasRenaming.current = renaming;
  }, [renaming, file.kind]);
  const files = useOS((state) => state.files);
  const cut = useOS((state) => state.cutFileIds.includes(file.id));
  const drop = useFileDrop(!trashed && file.kind === "folder" ? file.id : null);
  const small = view === "list";
  const Container = rename ? "div" : "button";
  return (
    <Container
      ref={(node: HTMLButtonElement | HTMLDivElement | null) => {
        itemButton.current = node instanceof HTMLButtonElement ? node : null;
      }}
      data-file-id={file.id}
      data-name-expanded={selected && selectedIds.length <= 1}
      style={style}
      className={`file-entry ${selected ? "file-selected" : ""} ${drop.highlighted ? "file-drop-target" : ""} ${cut ? "file-cut" : ""} ${rename ? "file-renaming" : ""}`}
      aria-label={file.name}
      title={
        view === "desktop"
          ? undefined
          : isProtected(file.id)
            ? `${file.name} (System folder)`
            : file.name
      }
      aria-pressed={rename ? undefined : selected}
      draggable={!rename && !trashed && !isProtected(file.id)}
      onDragStart={(event) => {
        if (!selected) onDragSelection?.();
        startFileDrag(event, file, selectedIds);
      }}
      onDragEnd={endFileDrag}
      {...drop.handlers}
      onClick={(event) => {
        event.stopPropagation();
        if (!rename) onSelect(event);
      }}
      onDoubleClick={() => {
        if (!rename && !trashed) onOpen();
      }}
      onKeyDown={(event) => {
        if (!rename && event.key === "Enter" && !trashed) {
          event.preventDefault();
          onOpen();
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span
        className={file.kind === "folder" ? "file-folder" : "file-document"}
      >
        <FileIcon
          file={file}
          size={
            small
              ? 20
              : view === "desktop"
                ? 38
                : file.kind === "folder"
                  ? 47
                  : 40
          }
          strokeWidth={1.3}
        />
      </span>
      {rename ? (
        <>
          <input
            ref={nameInput}
            className="desktop-name-input"
            aria-label="Item name"
            aria-invalid={Boolean(rename.error)}
            value={rename.value}
            onChange={(event) => rename.onChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={() => {
              if (!rename.onCommit())
                requestAnimationFrame(() => nameInput.current?.focus());
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                rename.onCommit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                rename.onCancel();
              }
            }}
          />
          {rename.error && (
            <span className="desktop-name-error" role="alert">
              {rename.error}
            </span>
          )}
        </>
      ) : (
        <span className="file-name">{file.name}</span>
      )}
      {!rename && view !== "desktop" && (
        <small>
          {file.kind === "folder"
            ? `${childrenOf(files, file.id).length} items`
            : `${new Blob([file.content]).size} bytes`}
        </small>
      )}
    </Container>
  );
}

export function FileShortcut({
  id,
  current,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
}: {
  id: string;
  current: string;
  selected: boolean;
  onSelect: (file: VFile) => void;
  onOpen: (file: VFile) => void;
  onContextMenu?: (event: React.MouseEvent, file: VFile) => void;
}) {
  const file = useOS((state) => state.files.find((file) => file.id === id));
  const drop = useFileDrop(file?.kind === "folder" ? id : null);
  if (!file) return null;
  return (
    <button
      className={`${file.kind === "folder" && id === current ? "selected" : ""} ${file.kind === "text" && selected ? "sidebar-item-selected" : ""} ${drop.highlighted ? "file-drop-target" : ""}`}
      title={file.name}
      aria-current={
        file.kind === "folder" && id === current ? "location" : undefined
      }
      aria-pressed={file.kind === "text" ? selected : undefined}
      onClick={() => (file.kind === "folder" ? onOpen(file) : onSelect(file))}
      onDoubleClick={() => {
        if (file.kind === "text") onOpen(file);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onOpen(file);
        }
      }}
      onContextMenu={(event) => onContextMenu?.(event, file)}
      {...drop.handlers}
    >
      <FileIcon file={file} size={17} />
      <span className="sidebar-file-name">{file.name}</span>
    </button>
  );
}
