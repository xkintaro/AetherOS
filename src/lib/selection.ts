export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export function selectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): SelectionRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
export function intersects(a: SelectionRect, b: SelectionRect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}
export function combineSelection(
  initial: string[],
  hits: string[],
  mode: "replace" | "add" | "toggle",
): string[] {
  if (mode === "replace") return hits;
  const result = new Set(initial);
  for (const id of hits) {
    if (mode === "toggle" && result.has(id)) result.delete(id);
    else result.add(id);
  }
  return [...result];
}
