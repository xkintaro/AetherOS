import type { AppId } from "./window-state";
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export const windowMinimums: Record<AppId, Viewport> = {
  files: { width: 640, height: 420 },
  settings: { width: 680, height: 460 },
  editor: { width: 560, height: 360 },
  terminal: { width: 520, height: 340 },
};
const defaultMinimum = { width: 480, height: 330 };
const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Resize from a fixed opposing edge; keep the titlebar inside the work area. */
export function resizeRect(
  rect: Rect,
  edge: string,
  dx: number,
  dy: number,
  viewport: Viewport,
  minimum: Viewport = defaultMinimum,
): Rect {
  const minWidth = minimum.width;
  const minHeight = minimum.height;
  let { x, y, width, height } = rect;
  if (edge.includes("e"))
    width = clamp(
      rect.width + dx,
      minWidth,
      Math.max(minWidth, viewport.width - rect.x - 12),
    );
  if (edge.includes("w")) {
    const right = rect.x + rect.width;
    width = clamp(rect.width - dx, minWidth, Math.max(minWidth, right - 12));
    x = right - width;
  }
  if (edge.includes("s"))
    height = clamp(
      rect.height + dy,
      minHeight,
      Math.max(minHeight, viewport.height - rect.y - 96),
    );
  if (edge.includes("n")) {
    const bottom = rect.y + rect.height;
    height = clamp(
      rect.height - dy,
      minHeight,
      Math.max(minHeight, bottom - 44),
    );
    y = bottom - height;
  }
  return { x, y, width, height };
}

/** Apply the same limits to restored sessions and browser viewport changes. */
export function constrainRect(
  rect: Rect,
  viewport: Viewport,
  minimum: Viewport,
): Rect {
  const width = Math.max(
    minimum.width,
    Math.min(rect.width, viewport.width - 24),
  );
  const height = Math.max(
    minimum.height,
    Math.min(rect.height, viewport.height - 140),
  );
  return {
    width,
    height,
    x: clamp(rect.x, 0, Math.max(0, viewport.width - width - 12)),
    y: clamp(rect.y, 42, Math.max(42, viewport.height - height - 96)),
  };
}
