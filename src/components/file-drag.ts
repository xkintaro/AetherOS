"use client";
import { useState, type DragEvent } from "react";
import { useOS } from "@/lib/store";
import { isProtected, moveError, type VFile } from "@/lib/filesystem";

export const FILE_DRAG_TYPE = "application/x-aetheros-file";
export function startFileDrag(event: DragEvent, file: VFile) {
  if (isProtected(file.id)) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(FILE_DRAG_TYPE, file.id);
  useOS.getState().setDraggedFile(file.id);
}
export function endFileDrag() {
  useOS.getState().setDraggedFile(null);
}
export function useFileDrop(target: string | null) {
  const [hovered, setHovered] = useState(false);
  const draggedId = useOS((state) => state.draggedFileId);
  const files = useOS((state) => state.files);
  const allowed = Boolean(
    target && draggedId && !moveError(files, draggedId, target),
  );
  function over(event: DragEvent) {
    if (!target || !event.dataTransfer.types.includes(FILE_DRAG_TYPE)) return;
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
        if (!target || !event.dataTransfer.types.includes(FILE_DRAG_TYPE))
          return;
        event.preventDefault();
        event.stopPropagation();
        setHovered(false);
        const id = event.dataTransfer.getData(FILE_DRAG_TYPE);
        if (id) {
          const result = useOS.getState().moveFile(id, target);
          if (!result.ok) useOS.getState().notify("Cannot move", result.error);
        }
        endFileDrag();
      },
    },
  };
}
