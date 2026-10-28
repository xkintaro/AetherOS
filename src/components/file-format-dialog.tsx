"use client";

import { useEffect, useRef } from "react";
import { FileWarning, X } from "lucide-react";
import { AppIcon } from "./icons";
import { useOS } from "@/lib/store";

export function FileFormatDialog() {
  const name = useOS((state) => state.unsupportedFile);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const dismiss = () => useOS.setState({ unsupportedFile: null });
  useEffect(() => {
    if (name !== null) {
      dialog.current?.showModal();
      confirmButton.current?.focus();
    } else dialog.current?.close();
  }, [name]);
  return (
    <dialog
      ref={dialog}
      className="file-format-dialog window-active"
      role="alertdialog"
      aria-labelledby="file-format-title"
      aria-describedby="file-format-description"
      onCancel={dismiss}
    >
      <div className="window-titlebar">
        <div className="window-app-label">
          <AppIcon app="files" size={14} />
          <span id="file-format-title">Unsupported file format</span>
        </div>
        <div className="window-controls">
          <button
            className="close-window"
            aria-label="Close dialog"
            onClick={dismiss}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="window-content">
        <div className="file-format-body">
          <FileWarning size={32} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="file-format-name">{name}</p>
            <p id="file-format-description">
              This file format is not supported yet.
            </p>
          </div>
        </div>
        <form
          method="dialog"
          onSubmit={dismiss}
          className="file-format-actions"
        >
          <button ref={confirmButton} className="small-button" autoFocus>
            OK
          </button>
        </form>
      </div>
    </dialog>
  );
}
