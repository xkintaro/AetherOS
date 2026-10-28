"use client";

import { useEffect, useRef } from "react";
import { useOS } from "@/lib/store";

export function FileFormatDialog() {
  const name = useOS((state) => state.unsupportedFile);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = () => useOS.setState({ unsupportedFile: null });
  useEffect(() => {
    if (name !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [name]);
  return (
    <dialog
      ref={dialog}
      className="file-format-dialog"
      role="alertdialog"
      aria-labelledby="file-format-title"
      aria-describedby="file-format-description"
      onCancel={dismiss}
    >
      <h2 id="file-format-title">Unsupported file format</h2>
      <p className="file-format-name">{name}</p>
      <p id="file-format-description">This file format is not supported yet.</p>
      <form method="dialog" onSubmit={dismiss}>
        <button className="small-button" autoFocus>
          OK
        </button>
      </form>
    </dialog>
  );
}
