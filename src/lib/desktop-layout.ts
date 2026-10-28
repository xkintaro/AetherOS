import type { Position, VFile } from "./filesystem";
const CELL = 96,
  PADDING = 16;
export function desktopCell(
  point: Position,
  height: number,
  width: number,
): Position {
  const columns = Math.max(1, Math.floor((width - PADDING * 2) / CELL)),
    rows = Math.max(1, Math.floor((height - PADDING * 2) / CELL));
  return {
    x:
      PADDING +
      Math.max(
        0,
        Math.min(columns - 1, Math.round((point.x - PADDING) / CELL)),
      ) *
        CELL,
    y:
      PADDING +
      Math.max(0, Math.min(rows - 1, Math.round((point.y - PADDING) / CELL))) *
        CELL,
  };
}
export function desktopLayout(
  files: VFile[],
  height: number,
  width: number,
): Map<string, Position> {
  const positions = new Map<string, Position>(),
    occupied = new Set<string>();
  const rows = Math.max(1, Math.floor((height - PADDING * 2) / CELL));
  const layoutWidth = Math.max(
    width,
    PADDING * 2 + Math.ceil(files.length / rows) * CELL,
  );
  const key = (p: Position) => `${p.x}:${p.y}`;
  for (const file of files) {
    if (file.desktopPosition) {
      const position = desktopCell(file.desktopPosition, height, layoutWidth);
      if (!occupied.has(key(position))) {
        positions.set(file.id, position);
        occupied.add(key(position));
      }
    }
  }
  let cell = 0;
  for (const file of files) {
    if (positions.has(file.id)) continue;
    let position: Position;
    do {
      position = {
        x: PADDING + Math.floor(cell / rows) * CELL,
        y: PADDING + (cell % rows) * CELL,
      };
      cell++;
    } while (occupied.has(key(position)));
    positions.set(file.id, position);
    occupied.add(key(position));
  }
  return positions;
}

/** Keep existing icons in place and snap a drop to the nearest empty cell. */
export function desktopDropPosition(
  files: VFile[],
  id: string,
  point: Position,
  height: number,
  width: number,
): Position {
  const others = files.filter((file) => file.id !== id);
  const occupied = new Set(
    [...desktopLayout(files, height, width)]
      .filter(([fileId]) => fileId !== id)
      .map(([, p]) => `${p.x}:${p.y}`),
  );
  const rows = Math.max(1, Math.floor((height - PADDING * 2) / CELL));
  const layoutWidth = Math.max(
    width,
    PADDING * 2 + Math.ceil((others.length + 1) / rows) * CELL,
  );
  const target = desktopCell(point, height, layoutWidth);
  if (!occupied.has(`${target.x}:${target.y}`)) return target;
  const columns = Math.max(
    1,
    Math.floor((width - PADDING * 2) / CELL),
    Math.ceil((others.length + 1) / rows),
  );
  let closest = target;
  let distance = Infinity;
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const candidate = { x: PADDING + column * CELL, y: PADDING + row * CELL };
      if (occupied.has(`${candidate.x}:${candidate.y}`)) continue;
      const nextDistance =
        (candidate.x - target.x) ** 2 + (candidate.y - target.y) ** 2;
      if (nextDistance < distance) {
        closest = candidate;
        distance = nextDistance;
      }
    }
  }
  return closest;
}
