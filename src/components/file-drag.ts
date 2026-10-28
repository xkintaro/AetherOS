"use client";
import { useState, type DragEvent } from "react";
import { useOS } from "@/lib/store";
import {
  isAvailable,
  isProtected,
  moveEntries,
  type VFile,
} from "@/lib/filesystem";

export const FILE_DRAG_TYPE = "application/x-aetheros-file";
export function draggedFileIds(event: DragEvent): string[] {
  const payload = event.dataTransfer.getData(FILE_DRAG_TYPE);
  try {
    const parsed: unknown = JSON.parse(payload);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string"))
      return [...new Set(parsed)];
  } catch {
    /* Support a drag started before a local refresh. */
  }
  return payload ? [payload] : [];
}
export function startFileDrag(
  event: DragEvent,
  file: VFile,
  selectedIds: string[] = [],
) {
  const state = useOS.getState();
  const ids = (
    selectedIds.includes(file.id)
      ? [file.id, ...selectedIds.filter((id) => id !== file.id)]
      : [file.id]
  ).filter((id) => !isProtected(id) && isAvailable(state.files, id));
  if (!ids.length || isProtected(file.id)) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify(ids));
  state.setDraggedFiles(ids);
}
export function endFileDrag() {
  useOS.getState().setDraggedFiles([]);
}
export function useFileDrop(target: string | null) {
  const [hovered, setHovered] = useState(false);
  const ids = useOS((state) => state.draggedFileIds);
  const files = useOS((state) => state.files);
  const allowed = Boolean(
    target &&
    ids.length &&
    (target === "trash" || moveEntries(files, ids, target).result.ok),
  );
  function over(event: DragEvent) {
    if (
      !target ||
      ids.includes(target) ||
      !event.dataTransfer.types.includes(FILE_DRAG_TYPE)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = allowed ? "move" : "none";
    setHovered(allowed);
  }
  return {
    highlighted: hovered && allowed,
    handlers: {
      onDragEnter: over,
      onDragOver: over,
      onDragLeave: (event: DragEvent) => {
        if (!(
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ))
          setHovered(false);
      },
      onDrop: (event: DragEvent) => {
        if (
          !target ||
          ids.includes(target) ||
          !event.dataTransfer.types.includes(FILE_DRAG_TYPE)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        setHovered(false);
        const droppedIds = draggedFileIds(event);
        if (droppedIds.length) {
          if (target === "trash") useOS.getState().trashFiles(droppedIds);
          else {
            const result = useOS.getState().moveFiles(droppedIds, target);
            if (!result.ok)
              useOS.getState().notify("Cannot move", result.error);
          }
        }
        endFileDrag();
      },
    },
  };
}
