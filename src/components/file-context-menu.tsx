"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  FolderPlus,
  FolderClosed,
  FileText,
  ClipboardPaste,
  Scissors,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import type { VFile } from "@/lib/filesystem";

type Props = {
  x: number;
  y: number;
  hasSelection: boolean;
  multiple?: boolean;
  canPaste: boolean;
  protectedItem?: boolean;
  trashed?: boolean;
  creationOnly?: boolean;
  label?: string;
  onCreate: (kind: VFile["kind"]) => void;
  onCut: () => void;
  onRename: () => void;
  onTrash: () => void;
  onPaste: () => void;
  onClose: () => void;
  onOpen?: () => void;
  onRestore?: () => void;
};

export function FileContextMenu({
  x,
  y,
  hasSelection,
  multiple = false,
  canPaste,
  protectedItem = false,
  trashed = false,
  creationOnly = false,
  label = "File menu",
  onCreate,
  onCut,
  onRename,
  onTrash,
  onPaste,
  onClose,
  onOpen,
  onRestore,
}: Props) {
  const root = useRef<HTMLDivElement>(null),
    newButton = useRef<HTMLButtonElement>(null),
    submenu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ x, y });
  const flip = position.x + 420 > window.innerWidth - 8;
  useLayoutEffect(() => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      y: Math.max(42, Math.min(y, window.innerHeight - rect.height - 12)),
    });
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [x, y]);
  function enterSubmenu() {
    setOpen(true);
    requestAnimationFrame(() =>
      submenu.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }
  function creations() {
    return (
      <>
        <button role="menuitem" onClick={() => onCreate("folder")}>
          <FolderClosed size={16} />
          <span>Folder</span>
        </button>
        <button role="menuitem" onClick={() => onCreate("text")}>
          <FileText size={16} />
          <span>Text Document</span>
        </button>
      </>
    );
  }
  function moveFocus(
    event: React.KeyboardEvent,
    element: HTMLElement | null,
    selector: string,
  ) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      element?.querySelectorAll<HTMLButtonElement>(selector) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[
      (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
        items.length
    ]?.focus();
  }
  return createPortal(
    <>
      <div
        className="desktop-menu-dismiss"
        onPointerDown={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        ref={root}
        className="desktop-context-menu"
        role="menu"
        aria-label={label}
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (
            event.key === "ArrowRight" &&
            document.activeElement === newButton.current
          ) {
            event.preventDefault();
            enterSubmenu();
          }
          moveFocus(
            event,
            root.current,
            ":scope > button, :scope > .desktop-new-menu > button",
          );
        }}
      >
        {creationOnly ? (
          creations()
        ) : trashed ? (
          <button role="menuitem" onClick={onRestore}>
            <RotateCcw size={15} />
            <span>Restore</span>
          </button>
        ) : hasSelection ? (
          <>
            {onOpen && !multiple && (
              <button role="menuitem" onClick={onOpen}>
                <ArrowUpRight size={15} />
                <span>Open</span>
                <kbd>Enter</kbd>
              </button>
            )}
            {!protectedItem && (
              <>
                <div className="desktop-menu-separator" role="separator" />
                <button role="menuitem" onClick={onCut}>
                  <Scissors size={15} />
                  <span>Cut</span>
                  <kbd>Ctrl+X</kbd>
                </button>
                {!multiple && (
                  <button role="menuitem" onClick={onRename}>
                    <Pencil size={15} />
                    <span>Rename</span>
                    <kbd>F2</kbd>
                  </button>
                )}
                <div className="desktop-menu-separator" role="separator" />
                <button role="menuitem" onClick={onTrash}>
                  <Trash2 size={15} />
                  <span>Move to trash</span>
                  <kbd>Del</kbd>
                </button>
              </>
            )}
          </>
        ) : (
          <div
            className="desktop-new-menu"
            onPointerEnter={() => setOpen(true)}
            onPointerLeave={() => setOpen(false)}
          >
            <button
              ref={newButton}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <FolderPlus size={15} />
              <span>New</span>
              <ChevronRight size={14} />
            </button>
            {open && (
              <div
                ref={submenu}
                role="menu"
                aria-label="New"
                className={`desktop-new-submenu ${flip ? "submenu-left" : ""}`}
                style={
                  position.y + 100 > window.innerHeight - 12
                    ? { top: "auto", bottom: -5 }
                    : undefined
                }
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setOpen(false);
                    newButton.current?.focus();
                  }
                  moveFocus(event, submenu.current, "button");
                }}
              >
                {creations()}
              </div>
            )}
          </div>
        )}
        {canPaste && !creationOnly && !trashed && (
          <>
            <div className="desktop-menu-separator" role="separator" />
            <button role="menuitem" onClick={onPaste}>
              <ClipboardPaste size={15} />
              <span>Paste</span>
              <kbd>Ctrl+V</kbd>
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
