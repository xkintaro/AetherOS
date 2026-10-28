"use client";
import { memo, useRef } from "react";
import { Minus, Copy, Square, X } from "lucide-react";
import { useOS, type WindowState } from "@/lib/store";
import { resizeRect, windowMinimums } from "@/lib/window-geometry";
import { Application } from "./applications";
import { ApplicationBoundary } from "./application-boundary";
import { AppIcon } from "./icons";

export function requestClose(id: string) {
  const el = document.querySelector(
    `[data-window-id="${CSS.escape(id)}"] [data-dirty="true"]`,
  );
  if (
    el &&
    !window.confirm("This document has unsaved changes. Close without saving?")
  )
    return;
  useOS.getState().close(id);
}
export const OSWindow = memo(function OSWindow({
  win,
  active,
  hidden,
}: {
  win: WindowState;
  active: boolean;
  hidden: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function drag(e: React.PointerEvent<HTMLDivElement>) {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest("button") ||
      win.maximized
    )
      return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX,
      sy = e.clientY;
    const start = { x: win.x, y: win.y };
    const move = (event: PointerEvent) => {
      const x = Math.max(
        -win.width + 140,
        Math.min(window.innerWidth - 140, start.x + event.clientX - sx),
      );
      const y = Math.max(
        8,
        Math.min(window.innerHeight - 120, start.y + event.clientY - sy),
      );
      if (ref.current) {
        ref.current.style.left = x + "px";
        ref.current.style.top = y + "px";
      }
    };
    const up = (event: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      useOS.getState().updateWindow(win.id, {
        x: Math.max(
          -win.width + 140,
          Math.min(window.innerWidth - 140, start.x + event.clientX - sx),
        ),
        y: Math.max(
          8,
          Math.min(window.innerHeight - 120, start.y + event.clientY - sy),
        ),
      });
    };
    const cancel = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      if (ref.current) {
        ref.current.style.left = win.x + "px";
        ref.current.style.top = win.y + "px";
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
  }
  function resize(e: React.PointerEvent<HTMLDivElement>, edge: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    useOS.getState().focus(win.id);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX,
      sy = e.clientY;
    let final: Partial<WindowState> = {};
    const move = (event: PointerEvent) => {
      const dx = event.clientX - sx,
        dy = event.clientY - sy;
      final = resizeRect(
        win,
        edge,
        dx,
        dy,
        {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        windowMinimums[win.app],
      );
      if (ref.current) {
        ref.current.style.width = final.width + "px";
        ref.current.style.height = final.height + "px";
        if (final.x !== undefined) ref.current.style.left = final.x + "px";
        if (final.y !== undefined) ref.current.style.top = final.y + "px";
      }
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      useOS.getState().updateWindow(win.id, final);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }
  return (
    <>
      <section
        data-window-id={win.id}
        ref={ref}
        className={`os-window ${active ? "window-active" : ""} ${win.maximized ? "window-maximized" : ""}`}
        style={{
          display: hidden ? "none" : undefined,
          minWidth: windowMinimums[win.app].width,
          minHeight: windowMinimums[win.app].height,
          left: win.maximized ? 10 : win.x,
          top: win.maximized ? 8 : win.y,
          width: win.maximized ? "calc(100vw - 20px)" : win.width,
          height: win.maximized ? "calc(100dvh - 104px)" : win.height,
          zIndex: 100 + win.z,
        }}
        onPointerDown={() => {
          if (!active) useOS.getState().focus(win.id);
        }}
        aria-label={win.title}
      >
        <div
          className="window-titlebar"
          onPointerDown={drag}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest("button"))
              useOS.getState().maximize(win.id);
          }}
        >
          <div className="window-app-label">
            <AppIcon app={win.app} size={14} />
            <span>{win.title}</span>
          </div>
          <div className="window-controls">
            <button
              aria-label="Minimize window"
              onClick={() =>
                useOS.getState().updateWindow(win.id, { minimized: true })
              }
            >
              <Minus size={14} />
            </button>
            <button
              aria-label={win.maximized ? "Restore window" : "Maximize window"}
              onClick={() => useOS.getState().maximize(win.id)}
            >
              {win.maximized ? <Copy size={12} /> : <Square size={12} />}
            </button>
            <button
              className="close-window"
              aria-label="Close window"
              onClick={() => requestClose(win.id)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="window-content">
          <ApplicationBoundary>
            <Application win={win} />
          </ApplicationBoundary>
        </div>
        {!win.maximized &&
          ["n", "ne", "nw", "e", "s", "w", "se", "sw"].map((edge) => (
            <div
              key={edge}
              className={`resize-handle resize-${edge}`}
              onPointerDown={(e) => resize(e, edge)}
            />
          ))}
      </section>
    </>
  );
});
