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
  const key = (p: Position) => `${p.x}:${p.y}`;
  for (const file of files) {
    if (file.desktopPosition) {
      const position = desktopCell(file.desktopPosition, height, width);
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
