"use client";
import { useRef, useState } from "react";
import {
  hasNameConflict,
  isProtected,
  validName,
  isTextFileName,
  openFileRenameMessage,
  type VFile,
} from "@/lib/filesystem";
import { useOS } from "@/lib/store";

export function useFileRename() {
  const [rename, setRename] = useState<{
    id: string;
    value: string;
    error: string;
  } | null>(null);
  const finished = useRef(false);
  function beginRename(file: VFile) {
    if (isProtected(file.id)) return;
    finished.current = false;
    setRename({ id: file.id, value: file.name, error: "" });
  }
  function cancelRename() {
    finished.current = true;
    setRename(null);
  }
  function commitRename(): boolean {
    if (!rename || finished.current) return true;
    const state = useOS.getState(),
      file = state.files.find((file) => file.id === rename.id);
    if (!file) {
      cancelRename();
      return true;
    }
    const name = rename.value;
    let error = "";
    if (!validName(name)) error = "Invalid name.";
    else if (
      file.kind === "text" &&
      name !== file.name &&
      !isTextFileName(name) &&
      state.windows.some(
        (window) => window.app === "editor" && window.fileId === file.id,
      )
    )
      error = openFileRenameMessage;
    else if (hasNameConflict(state.files, file.parent, name, file.id))
      error = "Name already exists.";
    else if (name !== file.name && !state.renameFile(file.id, name))
      error = "Cannot rename this item.";
    if (error) {
      setRename({ ...rename, error });
      return false;
    }
    finished.current = true;
    setRename(null);
    return true;
  }
  function renameProps(file: VFile) {
    return rename?.id === file.id
      ? {
          value: rename.value,
          error: rename.error,
          onChange: (value: string) =>
            setRename({ ...rename, value, error: "" }),
          onCommit: commitRename,
          onCancel: cancelRename,
        }
      : undefined;
  }
  return { beginRename, cancelRename, commitRename, renameProps };
}
