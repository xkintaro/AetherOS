"use client";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  combineSelection,
  intersects,
  selectionRect,
  type SelectionRect,
} from "@/lib/selection";
import type { VFile } from "@/lib/filesystem";

export function useFileSelection(scope: string, entries: VFile[]) {
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({
    scope,
    ids: [],
  });
  const visibleIds = new Set(entries.map((file) => file.id));
  const ids =
    selection.scope === scope
      ? selection.ids.filter((id) => visibleIds.has(id))
      : [];
  const selected = new Set(ids);
  const selectedFiles = entries.filter((file) => selected.has(file.id));
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const gesture = useRef<{
    start: { x: number; y: number };
    clientX: number;
    clientY: number;
    initial: string[];
    mode: "replace" | "add" | "toggle";
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [box, setBox] = useState<SelectionRect | null>(null);
  const set = (next: string[]) =>
    setSelection({ scope, ids: [...new Set(next)] });
  function select(
    id: string,
    event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">,
  ) {
    if (event.shiftKey && anchor.current && visibleIds.has(anchor.current)) {
      const order = entries.map((file) => file.id);
      const from = order.indexOf(anchor.current),
        to = order.indexOf(id);
      set(
        combineSelection(
          ids,
          order.slice(Math.min(from, to), Math.max(from, to) + 1),
          event.ctrlKey || event.metaKey ? "add" : "replace",
        ),
      );
    } else {
      set(
        combineSelection(
          ids,
          [id],
          event.ctrlKey || event.metaKey ? "toggle" : "replace",
        ),
      );
      anchor.current = id;
    }
  }
  function stop() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    gesture.current = null;
    setBox(null);
  }
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [scope],
  );
  useEffect(() => {
    anchor.current = null;
    stop();
    setSelection({ scope, ids: [] });
  }, [scope]);
  useEffect(() => {
    if (selection.scope === scope && ids.length !== selection.ids.length)
      set(ids);
  }, [scope, entries, selection]);
  function update() {
    const active = gesture.current,
      container = ref.current;
    if (!active || !container) return;
    const bounds = container.getBoundingClientRect();
    const end = {
      x:
        Math.max(0, Math.min(bounds.width, active.clientX - bounds.left)) +
        container.scrollLeft,
      y:
        Math.max(0, Math.min(bounds.height, active.clientY - bounds.top)) +
        container.scrollTop,
    };
    if (
      !active.moved &&
      Math.hypot(end.x - active.start.x, end.y - active.start.y) < 4
    )
      return;
    active.moved = true;
    const rectangle = selectionRect(active.start, end);
    setBox(rectangle);
    const hits: string[] = [];
    for (const element of container.querySelectorAll<HTMLElement>(
      "[data-file-id]",
    )) {
      const rect = element.getBoundingClientRect();
      const height = container.classList.contains("desktop-files")
        ? Math.min(88, rect.height)
        : rect.height;
      if (
        intersects(rectangle, {
          x: rect.left - bounds.left + container.scrollLeft,
          y: rect.top - bounds.top + container.scrollTop,
          width: rect.width,
          height,
        })
      )
        hits.push(element.dataset.fileId!);
    }
    set(combineSelection(active.initial, hits, active.mode));
  }
  function tick() {
    const active = gesture.current,
      container = ref.current;
    if (!active || !container) return;
    const bounds = container.getBoundingClientRect();
    const speed = (point: number, min: number, max: number) =>
      point < min + 24 ? -12 : point > max - 24 ? 12 : 0;
    const beforeX = container.scrollLeft,
      beforeY = container.scrollTop;
    if (active.moved) {
      container.scrollLeft += speed(active.clientX, bounds.left, bounds.right);
      container.scrollTop += speed(active.clientY, bounds.top, bounds.bottom);
      if (container.scrollLeft !== beforeX || container.scrollTop !== beforeY)
        update();
    }
    frame.current = requestAnimationFrame(tick);
  }
  const handlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      suppressClick.current = false;
      if (
        event.button !== 0 ||
        event.pointerType === "touch" ||
        (event.target as HTMLElement).closest(
          ".file-entry,button,input,textarea",
        )
      )
        return;
      event.preventDefault();
      ref.current?.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      const bounds = event.currentTarget.getBoundingClientRect();
      gesture.current = {
        start: {
          x: event.clientX - bounds.left + event.currentTarget.scrollLeft,
          y: event.clientY - bounds.top + event.currentTarget.scrollTop,
        },
        clientX: event.clientX,
        clientY: event.clientY,
        initial: ids,
        mode:
          event.ctrlKey || event.metaKey
            ? "toggle"
            : event.shiftKey
              ? "add"
              : "replace",
        moved: false,
        pointerId: event.pointerId,
      };
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) set([]);
      frame.current = requestAnimationFrame(tick);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!gesture.current || gesture.current.pointerId !== event.pointerId)
        return;
      gesture.current.clientX = event.clientX;
      gesture.current.clientY = event.clientY;
      update();
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (!gesture.current || gesture.current.pointerId !== event.pointerId)
        return;
      suppressClick.current = gesture.current.moved;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      stop();
    },
    onPointerCancel() {
      stop();
    },
    onLostPointerCapture() {
      stop();
    },
    onClickCapture(event: MouseEvent) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
  return {
    ids,
    selected,
    selectedFiles,
    single: selectedFiles.length === 1 ? selectedFiles[0] : undefined,
    ref,
    box,
    handlers,
    set,
    select,
    clear: () => {
      stop();
      set([]);
    },
    context: (id?: string) => {
      if (!id) set([]);
      else if (!selected.has(id)) set([id]);
    },
  };
}
