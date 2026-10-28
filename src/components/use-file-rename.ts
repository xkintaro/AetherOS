"use client";
import { useRef, useState } from "react";
import {
  hasNameConflict,
  isProtected,
  validName,
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
    let error = "";
    if (!validName(rename.value)) error = "Invalid name.";
    else if (hasNameConflict(state.files, file.parent, rename.value, file.id))
      error = "Name already exists.";
    else if (
      rename.value !== file.name &&
      !state.renameFile(file.id, rename.value)
    )
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
