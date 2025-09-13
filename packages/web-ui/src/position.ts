export interface Position {
  start: number;
  end: number;
  original: string;
}

export function hasOverlap(pos1: Position, pos2: Position): boolean {
  return (
    (pos1.start >= pos2.start && pos1.start < pos2.end) ||
    (pos1.end > pos2.start && pos1.end <= pos2.end) ||
    (pos1.start <= pos2.start && pos1.end >= pos2.end)
  );
}

export function checkOverlapWithAny(
  newPos: Position,
  existingPositions: Position[]
): boolean {
  return existingPositions.some(pos => hasOverlap(newPos, pos));
}

export function sortPositionsForDisplay(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => a.start - b.start);
}

export function sortPositionsForReplacement(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => b.start - a.start);
}
