// shared/src/board-types.ts

export type CellType = 'corner' | 'event' | 'chance' | 'line_entry';

export interface BoardCell {
  index: number;
  id: string;
  name: string;
  type: CellType;
  // For line entries
  lineId?: string;
  forceEntry?: boolean;
  entryFee?: number;
  // For corner cells
  cornerType?: 'start' | 'hospital' | 'ding' | 'waiting_room';
}

export interface LineCell {
  index: number;
  id: string;
  name: string;
  description: string;
  // Event handler id - server resolves by id
  handlerId: string;
}

export interface BoardLine {
  id: string;
  name: string;
  entryFee: number;
  forceEntry: boolean;
  cells: LineCell[];
  experienceCard: { id: string; name: string; description: string; handlerId: string; };
}

export interface BoardData {
  mainBoard: BoardCell[];
  lines: Record<string, BoardLine>;
}
